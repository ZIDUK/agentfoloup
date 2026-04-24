import { NextResponse } from "next/server";
import { InterviewService } from "@/services/interviews.service";
import { getAuthSession } from "@/lib/route-auth";
import { logger } from "@/lib/logger";

export async function DELETE(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing interview id" }, { status: 400 });
    }

    logger.info("delete-interview request received", { id });

    const interview = await InterviewService.getInterviewById(id);
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const linkedJobs = await InterviewService.getLinkedJobs(id);

    if (linkedJobs.length > 0) {
      const dreamitUrl = process.env.DREAMIT_URL;
      const secret = process.env.DREAMIT_FOLOUP_SECRET;
      const serviceRoleKey = process.env.DREAMIT_SUPABASE_SERVICE_ROLE_KEY;

      if (dreamitUrl && secret && serviceRoleKey) {
        for (const job of linkedJobs) {
          const dreamitRes = await fetch(`${dreamitUrl}/functions/v1/update-foloup-speech-link`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-foloup-secret": secret,
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ job_id: Number(job.job_id), foloup_speech_link: null }),
          });

          const data = await dreamitRes.json().catch(() => null);
          logger.info("delete-interview DreamIT speech link nullify response", { job_id: Number(job.job_id), status: dreamitRes.status });

          if (!dreamitRes.ok) {
            logger.error("delete-interview DreamIT speech link nullify failed", { status: dreamitRes.status, job_id: Number(job.job_id), response: data });
            return NextResponse.json(
              { error: "Failed to update foloup link — interview not deleted" },
              { status: 502 },
            );
          }
        }
      }
    }

    await InterviewService.deleteInterview(id);
    logger.info("delete-interview soft-deleted from DB", { id });

    return NextResponse.json({ response: "Interview deleted successfully" }, { status: 200 });
  } catch (err) {
    logger.error("Error deleting interview");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
