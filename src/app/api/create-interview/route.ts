import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { InterviewService } from "@/services/interviews.service";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { getAuthSession } from "@/lib/route-auth";
import { logger } from "@/lib/logger";

const base_url = process.env.NEXT_PUBLIC_LIVE_URL;

async function callDreamitSpeechLink(
  dreamitUrl: string,
  secret: string,
  serviceRoleKey: string,
  job_id: number,
  link: string | null,
): Promise<boolean> {
  try {
    const r = await fetch(`${dreamitUrl}/functions/v1/update-foloup-speech-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-foloup-secret": secret,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ job_id, foloup_speech_link: link }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request, res: Response) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url_id = nanoid();
    const url = `${base_url}/call/${url_id}`;
    const failedJobIds: number[] = [];
    const body = await req.json();

    logger.info("create-interview request received");

    const payload = body.interviewData;
    const jobs: { job_id: number; job_title: string }[] = Array.isArray(payload.jobs) ? payload.jobs : [];

    const interviewNameSlug = payload.name?.toLowerCase().replace(/\s/g, "-");
    const readableSlug = interviewNameSlug ? `${interviewNameSlug}-${url_id}` : null;

    const { jobs: _jobs, job_id: _job_id, job_title: _job_title, ...interviewPayload } = payload;

    await InterviewService.createInterview({
      ...interviewPayload,
      url: url,
      id: url_id,
      readable_slug: readableSlug,
    });

    logger.info("Interview created successfully");

    if (jobs.length > 0) {
      const supabase = getSupabaseAdminClient();
      const dreamitUrl = process.env.DREAMIT_URL;
      const secret = process.env.DREAMIT_FOLOUP_SECRET;
      const serviceRoleKey = process.env.DREAMIT_SUPABASE_SERVICE_ROLE_KEY;
      const dreamitConfigured = !!(dreamitUrl && secret && serviceRoleKey);

      if (supabase) {
        // DB first: insert all jobs with dreamit_synced = false (or true if no DreamIT)
        const { error: insertError } = await supabase
          .from("interview_job")
          .insert(jobs.map((j) => ({
            interview_id: url_id,
            job_id: j.job_id,
            job_title: j.job_title,
            dreamit_synced: !dreamitConfigured,
          })));

        if (insertError) {
          logger.error("create-interview: job linking failed", { insertError });
        } else if (dreamitConfigured) {
          const syncResults = await Promise.all(
            jobs.map(async (job) => ({
              job,
              ok: await callDreamitSpeechLink(dreamitUrl!, secret!, serviceRoleKey!, Number(job.job_id), url),
            })),
          );

          const succeeded = syncResults.filter((r) => r.ok).map((r) => r.job);
          const failed = syncResults.filter((r) => !r.ok).map((r) => r.job);

          logger.info("create-interview DreamIT results", { total: jobs.length, succeeded: succeeded.length, failed: failed.length });

          if (succeeded.length > 0) {
            await supabase
              .from("interview_job")
              .update({ dreamit_synced: true })
              .eq("interview_id", url_id)
              .in("job_id", succeeded.map((j) => j.job_id));
          }

          if (failed.length > 0) {
            failedJobIds.push(...failed.map((j) => j.job_id));

            // Compensate: delete rows that failed DreamIT sync
            const { error: compensateError } = await supabase
              .from("interview_job")
              .delete()
              .eq("interview_id", url_id)
              .in("job_id", failed.map((j) => j.job_id));

            if (compensateError) {
              // Compensation failed — rows stay with dreamit_synced = false, edge fn will retry
              logger.error("create-interview: compensation delete failed, edge fn will retry", {
                compensateError,
                jobIds: failed.map((j) => j.job_id),
              });
            }
          }
        }
      }
    }

    return NextResponse.json(
      {
        response: "Interview created successfully",
        ...(failedJobIds.length > 0 && { failedJobIds }),
      },
      { status: 200 },
    );
  } catch (err) {
    logger.error("Error creating interview");

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
