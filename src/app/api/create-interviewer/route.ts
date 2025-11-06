import { logger } from "@/lib/logger";
import { InterviewerService } from "@/services/interviewers.service";
import { NextResponse, NextRequest } from "next/server";
import { INTERVIEWERS } from "@/lib/constants";

export async function GET(res: NextRequest) {
  logger.info("create-interviewer request received");

  try {
    // Create interviewers (agent_id is optional for Deepgram Voice Agent)
    const lisaInterviewer = await InterviewerService.createInterviewer({
      agent_id: null, // Not needed for Deepgram Voice Agent
      ...INTERVIEWERS.LISA,
    });

    const bobInterviewer = await InterviewerService.createInterviewer({
      agent_id: null, // Not needed for Deepgram Voice Agent
      ...INTERVIEWERS.BOB,
    });

    logger.info("Interviewers created successfully");

    return NextResponse.json(
      {
        newInterviewer: lisaInterviewer,
        newSecondInterviewer: bobInterviewer,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Error creating interviewers:", error);

    return NextResponse.json(
      { error: "Failed to create interviewers", details: error },
      { status: 500 },
    );
  }
}
