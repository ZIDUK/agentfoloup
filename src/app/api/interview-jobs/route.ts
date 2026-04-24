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
    .eq("interview_id", interviewId);

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
    .eq("interview_id", interviewId);

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

  // Additions: fire DreamIT in parallel, only insert jobs that succeeded
  if (toAdd.length > 0) {
    let jobsToInsert = toAdd;

    if (dreamitConfigured) {
      const { data: interviewRow } = await supabase
        .from("interview")
        .select("url")
        .eq("id", interviewId)
        .single();

      const interviewUrl: string | null = interviewRow?.url ?? null;
      if (interviewUrl) {
        const results = await Promise.allSettled(
          toAdd.map(async (job): Promise<LinkedJob> => {
            const ok = await callDreamitSpeechLink(dreamitUrl!, secret!, serviceRoleKey!, Number(job.job_id), interviewUrl);
            if (!ok) throw new Error(`DreamIT failed for job ${job.job_id}`);
            return job;
          }),
        );
        jobsToInsert = results
          .filter((r): r is PromiseFulfilledResult<LinkedJob> => r.status === "fulfilled")
          .map((r) => r.value);
        logger.info("interview-jobs PUT: DreamIT add results", { total: toAdd.length, succeeded: jobsToInsert.length });
      }
    }

    if (jobsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("interview_job")
        .insert(jobsToInsert.map((j) => ({ interview_id: interviewId, job_id: j.job_id, job_title: j.job_title })));
      if (insertError) {
        logger.error("interview-jobs PUT: insert failed", { insertError });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  }

  // Removals: nullify DreamIT links in parallel, only delete jobs that succeeded
  if (toRemove.length > 0) {
    let jobIdsToRemove = toRemove.map((r) => r.job_id);

    if (dreamitConfigured) {
      const results = await Promise.allSettled(
        toRemove.map(async (job): Promise<number> => {
          const ok = await callDreamitSpeechLink(dreamitUrl!, secret!, serviceRoleKey!, Number(job.job_id), null);
          if (!ok) throw new Error(`DreamIT nullify failed for job ${job.job_id}`);
          return job.job_id;
        }),
      );
      jobIdsToRemove = results
        .filter((r): r is PromiseFulfilledResult<number> => r.status === "fulfilled")
        .map((r) => r.value);
      logger.info("interview-jobs PUT: DreamIT remove results", { total: toRemove.length, succeeded: jobIdsToRemove.length });
    }

    if (jobIdsToRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from("interview_job")
        .delete()
        .eq("interview_id", interviewId)
        .in("job_id", jobIdsToRemove);
      if (deleteError) {
        logger.error("interview-jobs PUT: delete failed", { deleteError });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
