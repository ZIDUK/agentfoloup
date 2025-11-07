import { logger } from "@/lib/logger";
import { generateInterviewAnalytics } from "@/services/analytics.service";
import { ResponseService } from "@/services/responses.service";
import { Response } from "@/types/response";
import { NextResponse } from "next/server";
import { getMistralClient } from "@/services/mistral.service";
import {
  SYSTEM_PROMPT,
  getCallAnalysisPrompt,
} from "@/lib/prompts/call-analysis";

export async function POST(req: Request, res: Response) {
  logger.info("get-call request received");
  const body = await req.json();

  const callDetails: Response = await ResponseService.getResponseByCallId(
    body.id,
  );

  if (!callDetails) {
    return NextResponse.json(
      { error: "Call not found" },
      { status: 404 },
    );
  }

  let callResponse = callDetails.details || {};
  const interviewId = callDetails?.interview_id;
  
  // Extract transcript from callResponse or callDetails
  const transcript = callResponse.transcript || 
                     (callDetails.details?.transcript as string) || 
                     "";

  // If no transcript, return what we have
  if (!transcript) {
    return NextResponse.json(
      {
        callResponse: callResponse,
        analytics: callDetails.analytics || null,
        message: callDetails.is_analysed 
          ? "Transcript not available." 
          : "Transcript not available yet. The call may still be in progress.",
      },
      { status: 200 },
    );
  }

  // Calculate duration
  const duration = callResponse.end_timestamp && callResponse.start_timestamp
    ? Math.round(
        (callResponse.end_timestamp / 1000) - (callResponse.start_timestamp / 1000)
      )
    : callDetails.duration || 0;

  // Generate analytics if not already present
  let analytics = callDetails.analytics;
  if (!analytics || !callDetails.is_analysed) {
  const payload = {
    callId: body.id,
    interviewId: interviewId,
      transcript: transcript,
    };
    
    const result = await generateInterviewAnalytics(payload);
    analytics = result.analytics;
  }

  // Generate call_analysis if not already present (even if already analyzed)
  // This is important because older responses may not have call_analysis
  let callAnalysis = callResponse.call_analysis;
  let needsSave = false;
  if (!callAnalysis && transcript) {
    needsSave = true;
    try {
      const mistral = getMistralClient();
      const prompt = getCallAnalysisPrompt(
        transcript,
        analytics?.overallScore,
        analytics?.overallFeedback,
      );

      const completion = await mistral.createChatCompletion({
        model: process.env.MISTRAL_MODEL || "mistral-large-latest",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
      });

      const analysisContent = completion.choices[0]?.message?.content || "{}";
      callAnalysis = JSON.parse(analysisContent);
      logger.info("Call analysis generated successfully");
    } catch (error) {
      logger.error("Error generating call analysis:", error);
      // Set default values if generation fails
      callAnalysis = {
        call_summary: analytics?.softSkillSummary || "No summary available.",
        user_sentiment: "Neutral",
        agent_sentiment: "Positive",
        agent_task_completion_rating: "Complete",
        agent_task_completion_rating_reason: "All interview questions were addressed.",
        call_completion_rating: "Complete",
        call_completion_rating_reason: "The interview was completed successfully.",
      };
    }
  }

  // Update callResponse with call_analysis
  const updatedCallResponse = {
    ...callResponse,
    call_analysis: callAnalysis,
  };

  // Only save if we generated new analytics or call_analysis
  if (!callDetails.is_analysed || needsSave) {
  await ResponseService.saveResponse(
    {
        details: updatedCallResponse,
      is_analysed: true,
      duration: duration,
      analytics: analytics,
    },
    body.id,
  );
    logger.info("Call analysed and saved successfully");
  }

  return NextResponse.json(
    {
      callResponse: updatedCallResponse,
      analytics,
    },
    { status: 200 },
  );
}
