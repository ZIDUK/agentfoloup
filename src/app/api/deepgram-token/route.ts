import { NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";
import { logger } from "@/lib/logger";

// DEEPGRAM_API_KEY must be an Admin-scoped key (keys:write) — it never
// leaves the server. The client only receives the short-lived token minted here.
const deepgram = process.env.DEEPGRAM_API_KEY
  ? createClient(process.env.DEEPGRAM_API_KEY)
  : null;

export async function POST(req: Request) {
  if (!deepgram) {
    logger.error("DEEPGRAM_API_KEY not configured");
    return NextResponse.json(
      { error: "Deepgram API key not configured" },
      { status: 500 },
    );
  }

  if (!process.env.DEEPGRAM_PROJECT_ID) {
    logger.error("DEEPGRAM_PROJECT_ID not configured");
    return NextResponse.json(
      { error: "Deepgram project not configured" },
      { status: 500 },
    );
  }

  let expiresIn = 3600;
  try {
    const body = await req.json();
    if (typeof body?.expires_in === "number" && body.expires_in > 0) {
      expiresIn = body.expires_in;
    }
  } catch {
    // no body — use default
  }

  try {
    const { result, error } = await deepgram.manage.createProjectKey(
      process.env.DEEPGRAM_PROJECT_ID,
      {
        comment: "Interview session token",
        scopes: ["usage:write"],
        tags: ["interview"],
        time_to_live_in_seconds: expiresIn,
      },
    );

    if (error || !result?.key) {
      logger.error("Deepgram token error:", error);
      return NextResponse.json(
        { error: "Failed to create Deepgram token" },
        { status: 500 },
      );
    }

    logger.info(`Deepgram token minted (ttl=${expiresIn}s)`);
    return NextResponse.json({ token: result.key }, { status: 200 });
  } catch (err) {
    logger.error("Deepgram token error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

