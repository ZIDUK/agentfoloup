import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { getAuthSession } from "@/lib/route-auth";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const interviewId = req.nextUrl.searchParams.get("interviewId");
  if (!interviewId) return NextResponse.json({ error: "interviewId required" }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("interview-jobs GET: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("interview_job")
    .select("job_id, job_title")
    .eq("interview_id", interviewId)
    .eq("pending_removal", false);

  if (error) {
    logger.error("interview-jobs GET: query failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ jobs: data ?? [] });
}

type LinkedJob = { job_id: number; job_title: string };

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

export async function PUT(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { interviewId: string; jobs: LinkedJob[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { interviewId, jobs } = body;

  const failedJobIds: number[] = [];

  if (!interviewId || !/^[A-Za-z0-9_-]+$/.test(interviewId)) {
    return NextResponse.json({ error: "Invalid interviewId" }, { status: 400 });
  }
  if (!Array.isArray(jobs)) {
    return NextResponse.json({ error: "jobs must be an array" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("interview-jobs PUT: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: currentRows, error: fetchError } = await supabase
    .from("interview_job")
    .select("job_id, job_title")
    .eq("interview_id", interviewId)
    .eq("pending_removal", false);

  if (fetchError) {
    logger.error("interview-jobs PUT: fetch current jobs failed", { fetchError });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const current: LinkedJob[] = (currentRows ?? []) as LinkedJob[];
  const newJobIds = new Set(jobs.map((j) => j.job_id));
  const currentJobIds = new Set(current.map((r) => r.job_id));

  const toAdd = jobs.filter((j) => !currentJobIds.has(j.job_id));
  const toRemove = current.filter((r) => !newJobIds.has(r.job_id));

  const dreamitUrl = process.env.DREAMIT_URL;
  const secret = process.env.DREAMIT_FOLOUP_SECRET;
  const serviceRoleKey = process.env.DREAMIT_SUPABASE_SERVICE_ROLE_KEY;
  const dreamitConfigured = !!(dreamitUrl && secret && serviceRoleKey);

  // ADDITIONS: DB first, then sync DreamIT
  if (toAdd.length > 0) {
    const { error: insertError } = await supabase
      .from("interview_job")
      .insert(toAdd.map((j) => ({
        interview_id: interviewId,
        job_id: j.job_id,
        job_title: j.job_title,
        dreamit_synced: !dreamitConfigured,
      })));

    if (insertError) {
      logger.error("interview-jobs PUT: insert failed", { insertError });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (dreamitConfigured) {
      const { data: interviewRow } = await supabase
        .from("interview")
        .select("url")
        .eq("id", interviewId)
        .single();

      const interviewUrl: string | null = interviewRow?.url ?? null;

      if (interviewUrl) {
        const syncResults = await Promise.all(
          toAdd.map(async (job) => ({
            job,
            ok: await callDreamitSpeechLink(dreamitUrl!, secret!, serviceRoleKey!, Number(job.job_id), interviewUrl),
          })),
        );

        const succeeded = syncResults.filter((r) => r.ok).map((r) => r.job);
        const failed = syncResults.filter((r) => !r.ok).map((r) => r.job);

        logger.info("interview-jobs PUT: DreamIT add results", { total: toAdd.length, succeeded: succeeded.length, failed: failed.length });

        if (succeeded.length > 0) {
          await supabase
            .from("interview_job")
            .update({ dreamit_synced: true })
            .eq("interview_id", interviewId)
            .in("job_id", succeeded.map((j) => j.job_id));
        }

        if (failed.length > 0) {
            failed.forEach((j) => failedJobIds.push(j.job_id));

            // Compensate: delete rows that failed DreamIT sync
            const { error: compensateError } = await supabase
              .from("interview_job")
              .delete()
              .eq("interview_id", interviewId)
              .in("job_id", failed.map((j) => j.job_id));

            if (compensateError) {
              // Compensation failed — rows stay with dreamit_synced = false, edge fn will retry
              logger.error("interview-jobs PUT: compensation delete failed, edge fn will retry", {
                compensateError,
                jobIds: failed.map((j) => j.job_id),
              });
            }
          }
      }
    }
  }

  // REMOVALS: mark pending_removal first, then sync DreamIT
  if (toRemove.length > 0) {
    if (!dreamitConfigured) {
      const { error: deleteError } = await supabase
        .from("interview_job")
        .delete()
        .eq("interview_id", interviewId)
        .in("job_id", toRemove.map((r) => r.job_id));

      if (deleteError) {
        logger.error("interview-jobs PUT: delete failed", { deleteError });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    } else {
      const { error: markError } = await supabase
        .from("interview_job")
        .update({ pending_removal: true })
        .eq("interview_id", interviewId)
        .in("job_id", toRemove.map((r) => r.job_id));

      if (markError) {
        logger.error("interview-jobs PUT: mark pending_removal failed", { markError });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      const syncResults = await Promise.all(
        toRemove.map(async (job) => ({
          job,
          ok: await callDreamitSpeechLink(dreamitUrl!, secret!, serviceRoleKey!, Number(job.job_id), null),
        })),
      );

      const succeeded = syncResults.filter((r) => r.ok).map((r) => r.job);
      const failed = syncResults.filter((r) => !r.ok).map((r) => r.job);

      logger.info("interview-jobs PUT: DreamIT remove results", { total: toRemove.length, succeeded: succeeded.length, failed: failed.length });

      if (succeeded.length > 0) {
        const { error: deleteError } = await supabase
          .from("interview_job")
          .delete()
          .eq("interview_id", interviewId)
          .in("job_id", succeeded.map((j) => j.job_id));

        if (deleteError) {
          // pending_removal stays true — edge fn will retry
          logger.error("interview-jobs PUT: delete after DreamIT success failed, edge fn will retry", { deleteError });
        }
      }

      if (failed.length > 0) {
        // pending_removal stays true — edge fn will retry
        logger.warn("interview-jobs PUT: DreamIT nullify failed for some jobs, edge fn will retry", {
          jobIds: failed.map((j) => j.job_id),
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    ...(failedJobIds.length > 0 && { failedJobIds }),
  });
}
