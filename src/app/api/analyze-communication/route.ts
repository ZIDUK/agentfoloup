import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { callLlmEdgeFunction } from "@/lib/llm-client";

export async function POST(req: Request) {
  logger.info("analyze-communication request received");

  try {
    const body = await req.json();
    const { transcript } = body;

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 },
      );
    }

    const result = await callLlmEdgeFunction<{ analysis: Record<string, unknown> }>(
      "analyze_communication",
      { transcript },
    );

    logger.info("Communication analysis completed successfully");

    return NextResponse.json({ analysis: result.analysis }, { status: 200 });
  } catch (error) {
    logger.error("Error analyzing communication skills");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
