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

    let interview: any = null;
    if (adminSupabase) {
      const { data } = await adminSupabase
        .from("interview")
        .select("job_id, url")
        .eq("id", id)
        .single();
      interview = data;
    } else {
      interview = await InterviewService.getInterviewById(id);
    }

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const jobId = interview.job_id;

    if (jobId) {
      const dreamitUrl = process.env.DREAMIT_URL;
      const secret = process.env.DREAMIT_FOLOUP_SECRET;
      const serviceRoleKey = process.env.DREAMIT_SUPABASE_SERVICE_ROLE_KEY;

      if (dreamitUrl && secret && serviceRoleKey) {
        const foloupLink = is_active ? interview.url : null;

        const dreamitRes = await fetch(`${dreamitUrl}/functions/v1/update-foloup-speech-link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-foloup-secret": secret,
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ job_id: Number(jobId), foloup_speech_link: foloupLink }),
        });

        const data = await dreamitRes.json().catch(() => null);
        logger.info("toggle-interview-status DreamIT response", { job_id: Number(jobId), is_active, status: dreamitRes.status });

        if (!dreamitRes.ok) {
          logger.error("toggle-interview-status DreamIT update failed", { status: dreamitRes.status, job_id: Number(jobId), response: data });
          return NextResponse.json(
            { error: "Failed to update foloup link — status not changed" },
            { status: 502 },
          );
        }
      }
    }

    await InterviewService.updateInterview({ is_active }, id);
    logger.info("toggle-interview-status updated", { id, is_active });

    return NextResponse.json({ response: "Interview status updated" }, { status: 200 });
  } catch (err) {
    logger.error("Error toggling interview status");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
