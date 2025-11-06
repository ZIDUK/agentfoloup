import { logger } from "@/lib/logger";
import { InterviewerService } from "@/services/interviewers.service";
import { NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";
import { nanoid } from "nanoid";

// Initialize Deepgram client
const deepgram = process.env.DEEPGRAM_API_KEY
  ? createClient(process.env.DEEPGRAM_API_KEY || "")
  : null;

export async function POST(req: Request, res: Response) {
  logger.info("register-call request received");

  try {
    const body = await req.json();

    const interviewerId = body.interviewer_id;
    
    if (!interviewerId) {
      logger.error("No interviewer_id provided");
      return NextResponse.json(
        { error: "interviewer_id is required" },
        { status: 400 },
      );
    }

    // getInterviewer now accepts bigint, number, or string
    const interviewer = await InterviewerService.getInterviewer(interviewerId);

    if (!interviewer) {
      logger.error(`Interviewer not found: ${interviewerId}`);
      return NextResponse.json(
        { error: "Interviewer not found" },
        { status: 404 },
      );
    }

    // Use Deepgram Voice Agent API
    if (deepgram) {
      // Generate a temporary token for Deepgram
      const callId = nanoid();
      
      try {
        const { result, error } = await deepgram.listen.manage.createProjectKey(
          process.env.DEEPGRAM_PROJECT_ID || "",
          {
            comment: `Interview call ${callId}`,
            scopes: ["usage:write"],
            tags: ["interview", callId],
            time_to_live_in_seconds: 3600, // 1 hour
          }
        );

        if (error) {
          logger.error("Deepgram token error:", error);
          return NextResponse.json(
            { error: "Failed to create Deepgram token" },
            { status: 500 },
          );
        }

        logger.info("Call registered successfully with Deepgram");

        return NextResponse.json(
          {
            registerCallResponse: {
              call_id: callId,
              access_token: result?.key,
              dynamic_data: body.dynamic_data,
              interviewer_id: interviewerId,
            },
            provider: "deepgram",
          },
          { status: 200 },
        );
      } catch (error) {
        logger.error("Error generating Deepgram token:", error);
        return NextResponse.json(
          { error: "Internal server error", details: String(error) },
          { status: 500 },
        );
      }
  } else {
    // Development mode: return a mock response
    logger.info("No voice provider configured, using development mode");
    const callId = nanoid();
    
    return NextResponse.json(
      {
        registerCallResponse: {
          call_id: callId,
          access_token: "dev-token-" + callId,
          dynamic_data: body.dynamic_data,
          interviewer_id: interviewerId,
        },
        provider: "development",
      },
      { status: 200 },
    );
  }
  } catch (error) {
    logger.error("Error in register-call:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
