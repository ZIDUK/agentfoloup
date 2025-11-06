import { NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";
import { logger } from "@/lib/logger";

const deepgram = process.env.DEEPGRAM_API_KEY
  ? createClient(process.env.DEEPGRAM_API_KEY || "")
  : null;

/**
 * Generate a temporary token for Deepgram Live API
 * This allows the client to connect directly to Deepgram
 */
export async function POST(req: Request) {
  if (!deepgram) {
    return NextResponse.json(
      { error: "Deepgram API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { expires_in = 3600 } = await req.json();

    if (!process.env.DEEPGRAM_PROJECT_ID) {
      logger.error("DEEPGRAM_PROJECT_ID not configured");
      return NextResponse.json(
        { error: "DEEPGRAM_PROJECT_ID not configured" },
        { status: 500 }
      );
    }

    const { result, error } = await deepgram.listen.manage.createProjectKey(
      process.env.DEEPGRAM_PROJECT_ID,
      {
        comment: "Temporary token for interview",
        scopes: ["usage:write"],
        tags: ["interview"],
        time_to_live_in_seconds: expires_in,
      }
    );

    if (error) {
      logger.error("Deepgram token error:", error);
      return NextResponse.json(
        { error: "Failed to create Deepgram token" },
        { status: 500 }
      );
    }

    logger.info("Deepgram token generated successfully");

    return NextResponse.json(
      {
        token: result?.key,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("Error generating Deepgram token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

