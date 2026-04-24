import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { InterviewService } from "@/services/interviews.service";
import { getAuthSession } from "@/lib/route-auth";
import { logger } from "@/lib/logger";

const base_url = process.env.NEXT_PUBLIC_LIVE_URL;

export async function POST(req: Request, res: Response) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url_id = nanoid();
    const url = `${base_url}/call/${url_id}`;
    const body = await req.json();

    logger.info("create-interview request received");

    const payload = body.interviewData;
    const jobs: { job_id: number; job_title: string }[] = Array.isArray(payload.jobs) ? payload.jobs : [];

    const interviewNameSlug = payload.name?.toLowerCase().replace(/\s/g, "-");
    const readableSlug = interviewNameSlug ? `${interviewNameSlug}-${url_id}` : null;

    if (jobs.length > 0) {
      const dreamitUrl = process.env.DREAMIT_URL;
      const secret = process.env.DREAMIT_FOLOUP_SECRET;
      const serviceRoleKey = process.env.DREAMIT_SUPABASE_SERVICE_ROLE_KEY;

      if (dreamitUrl && secret && serviceRoleKey) {
        for (const job of jobs) {
          const dreamitRes = await fetch(`${dreamitUrl}/functions/v1/update-foloup-speech-link`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-foloup-secret": secret,
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ job_id: Number(job.job_id), foloup_speech_link: url }),
          });

          const data = await dreamitRes.json().catch(() => null);
          logger.info("create-interview DreamIT speech link update response", { job_id: Number(job.job_id), status: dreamitRes.status });

          if (!dreamitRes.ok) {
            logger.error("create-interview DreamIT speech link update failed", { status: dreamitRes.status, job_id: Number(job.job_id), response: data });
            return NextResponse.json(
              { error: "Failed to update foloup link — interview not created" },
              { status: 502 },
            );
          }
        }
      }
    }

    const { jobs: _jobs, job_id: _job_id, job_title: _job_title, ...interviewPayload } = payload;

    await InterviewService.createInterview({
      ...interviewPayload,
      url: url,
      id: url_id,
      readable_slug: readableSlug,
    });

    if (jobs.length > 0) {
      await InterviewService.linkJobsToInterview(url_id, jobs);
    }

    logger.info("Interview created successfully");

    return NextResponse.json(
      { response: "Interview created successfully" },
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
