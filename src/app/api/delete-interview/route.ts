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
      const jobNames = linkedJobs.map((j: { job_title: string }) => j.job_title).join(", ");
      return NextResponse.json(
        { error: `This interview is linked to ${linkedJobs.length} job(s): ${jobNames}. Please remove all job references before deleting.` },
        { status: 409 },
      );
    }

    await InterviewService.deleteInterview(id);
    logger.info("delete-interview soft-deleted from DB", { id });

    return NextResponse.json({ response: "Interview deleted successfully" }, { status: 200 });
  } catch (err) {
    logger.error("Error deleting interview");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
