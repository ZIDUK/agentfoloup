import { logger } from "@/lib/logger";
import { InterviewerService } from "@/services/interviewers.service";
import { NextResponse, NextRequest } from "next/server";
import { INTERVIEWERS } from "@/lib/constants";

export async function GET(res: NextRequest) {
  logger.info("create-interviewer request received");

  try {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error("Supabase is not configured. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
      return NextResponse.json(
        {
          error: "Supabase is not configured",
          details: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables are required",
          newInterviewer: null,
          newSecondInterviewer: null,
        },
        { status: 500 },
      );
    }

    // Create interviewers (agent_id is optional for Deepgram Voice Agent)
    const lisaInterviewer = await InterviewerService.createInterviewer({
      agent_id: null, // Not needed for Deepgram Voice Agent
      ...INTERVIEWERS.LISA,
    });

    const bobInterviewer = await InterviewerService.createInterviewer({
      agent_id: null, // Not needed for Deepgram Voice Agent
      ...INTERVIEWERS.BOB,
    });

    if (!lisaInterviewer || !bobInterviewer) {
      logger.error("Failed to create interviewers. One or both returned null.");
      return NextResponse.json(
        {
          error: "Failed to create interviewers",
          details: "InterviewerService.createInterviewer returned null. Check server logs for details.",
          newInterviewer: lisaInterviewer,
          newSecondInterviewer: bobInterviewer,
        },
        { status: 500 },
      );
    }

    logger.info("Interviewers created successfully", { lisa: lisaInterviewer, bob: bobInterviewer });

    return NextResponse.json(
      {
        newInterviewer: lisaInterviewer,
        newSecondInterviewer: bobInterviewer,
      },
      { status: 200 },
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error("Error creating interviewers:", errorMessage);

    return NextResponse.json(
      {
        error: "Failed to create interviewers",
        details: errorMessage,
        newInterviewer: null,
        newSecondInterviewer: null,
      },
      { status: 500 },
    );
  }
}
