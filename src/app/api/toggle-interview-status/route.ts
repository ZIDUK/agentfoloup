import { NextResponse } from "next/server";
import { InterviewService } from "@/services/interviews.service";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { getAuthSession } from "@/lib/route-auth";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { id, is_active } = body;
    if (!id || typeof is_active !== "boolean") {
      return NextResponse.json({ error: "Missing id or is_active" }, { status: 400 });
    }

    const adminSupabase = getSupabaseAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const { data: interview } = await adminSupabase
      .from("interview")
      .select("url")
      .eq("id", id)
      .single();

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const linkedJobs = await InterviewService.getLinkedJobs(id);

    // DB first: update is_active
    const { error: updateError } = await adminSupabase
      .from("interview")
      .update({ is_active })
      .eq("id", id);

    if (updateError) {
      logger.error("toggle-interview-status: DB update failed", { updateError });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Then sync DreamIT
    if (linkedJobs.length > 0) {
      const dreamitUrl = process.env.DREAMIT_URL;
      const secret = process.env.DREAMIT_FOLOUP_SECRET;
      const serviceRoleKey = process.env.DREAMIT_SUPABASE_SERVICE_ROLE_KEY;

      if (dreamitUrl && secret && serviceRoleKey) {
        const foloupLink = is_active ? interview.url : null;

        const syncResults = await Promise.all(
          linkedJobs.map(async (job) => {
            const dreamitRes = await fetch(`${dreamitUrl}/functions/v1/update-foloup-speech-link`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-foloup-secret": secret,
                "Authorization": `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({ job_id: Number(job.job_id), foloup_speech_link: foloupLink }),
            });
            logger.info("toggle-interview-status DreamIT response", { job_id: Number(job.job_id), is_active, status: dreamitRes.status });
            return { job, ok: dreamitRes.ok };
          }),
        );

        const anyFailed = syncResults.some((r) => !r.ok);

        if (anyFailed) {
          logger.error("toggle-interview-status: DreamIT failed, compensating DB");

          // Compensate: revert is_active in DB
          const { error: revertError } = await adminSupabase
            .from("interview")
            .update({ is_active: !is_active })
            .eq("id", id);

          if (revertError) {
            // Compensation failed — DB and DreamIT are inconsistent, needs manual fix
            logger.error("toggle-interview-status: DB revert also failed", { revertError, id, attempted_is_active: is_active });
          }

          return NextResponse.json(
            { error: "Failed to update foloup link — status not changed" },
            { status: 502 },
          );
        }
      }
    }

    logger.info("toggle-interview-status updated", { id, is_active });
    return NextResponse.json({ response: "Interview status updated" }, { status: 200 });
  } catch (err) {
    logger.error("Error toggling interview status");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
