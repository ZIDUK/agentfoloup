import { NextResponse } from "next/server";
import { ResponseService } from "@/services/responses.service";
import { InterviewService } from "@/services/interviews.service";
import { logger } from "@/lib/logger";
import { callLlmEdgeFunction } from "@/lib/llm-client";

export async function POST(req: Request) {
  logger.info("generate-insights request received");
  const body = await req.json();

  const responses = await ResponseService.getAllResponses(body.interviewId);
  const interview = await InterviewService.getInterviewById(body.interviewId);

  let callSummaries = "";
  if (responses) {
    responses.forEach((response: any) => {
      callSummaries += response.details?.call_analysis?.call_summary;
    });
  }

  try {
    const result = await callLlmEdgeFunction<{ response: string }>(
      "generate_insights",
      {
        callSummaries,
        interviewName: interview.name,
        interviewObjective: interview.objective,
        interviewDescription: interview.description,
      },
    );

    const insightsResponse = JSON.parse(result.response);

    await InterviewService.updateInterview(
      { insights: insightsResponse.insights },
      body.interviewId,
    );

    logger.info("Insights generated successfully");

    return NextResponse.json({ response: result.response }, { status: 200 });
  } catch (error) {
    logger.error("Error generating insights");
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
