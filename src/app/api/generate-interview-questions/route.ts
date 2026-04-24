import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/route-auth";
import { logger } from "@/lib/logger";
import { callLlmEdgeFunction } from "@/lib/llm-client";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  logger.info("generate-interview-questions request received");
  const body = await req.json();

  try {
    const result = await callLlmEdgeFunction<{ response: string }>(
      "generate_questions",
      body,
    );

    logger.info("Interview questions generated successfully");

    return NextResponse.json({ response: result.response }, { status: 200 });
  } catch (error: any) {
    logger.error("Error generating interview questions", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
