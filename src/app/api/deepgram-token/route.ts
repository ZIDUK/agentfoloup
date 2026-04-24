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

  const projectId = process.env.DEEPGRAM_PROJECT_ID;
  logger.info(
    `Deepgram token request — project=${projectId} ttl=${expiresIn}s`,
  );

  try {
    const { result, error } = await deepgram.manage.createProjectKey(
      projectId,
      {
        comment: "Interview session token",
        scopes: ["usage:write"],
        tags: ["interview"],
        time_to_live_in_seconds: expiresIn,
      },
    );

    if (error) {
      // DeepgramApiError surfaces as an object with status + message fields
      const status = (error as { status?: number }).status;
      const message = (error as { message?: string }).message ?? String(error);
      logger.error(
        `Deepgram createProjectKey failed — status=${status} message="${message}" project=${projectId}`,
      );
      if (status === 403 || /scope/i.test(message)) {
        logger.error(
          "Fix: DEEPGRAM_API_KEY must be an Admin-scoped key with keys:write permission. " +
            "Go to console.deepgram.com → API Keys → ensure the key role is 'Admin'.",
        );
      }
      return NextResponse.json(
        { error: "Failed to create Deepgram token" },
        { status: 500 },
      );
    }

    if (!result?.key) {
      logger.error(
        `Deepgram createProjectKey returned no key — result=${JSON.stringify(result)} project=${projectId}`,
      );
      return NextResponse.json(
        { error: "Failed to create Deepgram token" },
        { status: 500 },
      );
    }

    logger.info(`Deepgram token minted (ttl=${expiresIn}s)`);
    return NextResponse.json({ token: result.key }, { status: 200 });
  } catch (err) {
    const status = (err as { status?: number }).status;
    const message = (err as { message?: string }).message ?? String(err);
    logger.error(
      `Deepgram token error — status=${status} message="${message}" project=${projectId}`,
    );
    if (status === 403 || /scope/i.test(message)) {
      logger.error(
        "Fix: DEEPGRAM_API_KEY must be an Admin-scoped key with keys:write permission. " +
          "Go to console.deepgram.com → API Keys → ensure the key role is 'Admin'.",
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

