import { logger } from "@/lib/logger";
import { generateInterviewAnalytics } from "@/services/analytics.service";
import { ResponseService } from "@/services/responses.service";
import { Response } from "@/types/response";
import { NextResponse } from "next/server";
import { callLlmEdgeFunction } from "@/lib/llm-client";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { InterviewService } from "@/services/interviews.service";

export async function POST(req: Request) {
  logger.info("get-call request received");
  let body: any;
  try {
    body = await req.json();
  } catch {
    logger.error("get-call: invalid or empty request body");
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Use admin client to bypass RLS — this route is public and needs to read
  // any response regardless of which user owns the interview.
  const adminSupabase = getSupabaseAdminClient();

  const adminSave = async (payload: any) => {
    if (adminSupabase) {
      const { error } = await adminSupabase
        .from("response")
        .update(payload)
        .eq("call_id", body.id);
      if (error) logger.error("Admin save error:", error);
    } else {
      await ResponseService.saveResponse(payload, body.id);
    }
  };

  let callDetails: Response | null = null;
  if (adminSupabase) {
    const { data } = await adminSupabase
      .from("response")
      .select("*")
      .filter("call_id", "eq", body.id);
    callDetails = data ? data[0] : null;
  } else {
    callDetails = await ResponseService.getResponseByCallId(body.id);
  }

  if (!callDetails) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  let callResponse = callDetails.details || {};
  const interviewId = callDetails?.interview_id;

  const transcript: string =
    callResponse.transcript ||
    (callDetails.details?.transcript as string) ||
    "";

  if (!transcript) {
    return NextResponse.json(
      {
        callResponse,
        analytics: callDetails.analytics || null,
        message: callDetails.is_analysed
          ? "Transcript not available."
          : "Transcript not available yet. The call may still be in progress.",
      },
      { status: 200 },
    );
  }

  const duration =
    callResponse.end_timestamp && callResponse.start_timestamp
      ? Math.round(
          callResponse.end_timestamp / 1000 -
            callResponse.start_timestamp / 1000,
        )
      : callDetails.duration || 0;

  // Pre-fetch the interview questions once with the admin client so both
  // analytics generation steps share the same data without extra round-trips.
  let questions: any[] | undefined;
  if (adminSupabase) {
    const { data: interviewData } = await adminSupabase
      .from("interview")
      .select("questions")
      .eq("id", interviewId)
      .single();
    questions = interviewData?.questions || [];
  } else {
    const interview = await InterviewService.getInterviewById(interviewId);
    questions = interview?.questions || [];
  }

  const transcriptObject: any[] =
    callDetails.details?.transcript_object || [];

  // ── Step 1: Generate analytics (scores, CEFR, question summaries) ──────────
  let analytics = callDetails.analytics;
  let analyticsFailed = false;

  if (!analytics || !callDetails.is_analysed) {
    const result = await generateInterviewAnalytics({
      callId: body.id,
      interviewId,
      transcript,
      existingAnalytics: callDetails.analytics,
      transcriptObject,
      questions,
    });

    if (result.error || !result.analytics) {
      analyticsFailed = true;
      logger.error(`Analytics generation failed for call ${body.id}`);
    } else {
      analytics = result.analytics;
    }
  }

  // Enrich analytics with proctoring fields so they are stored in the analytics
  // column and forwarded to DreamIT as part of the same object.
  if (analytics) {
    const proctoringEvents: any[] = callDetails.proctoring_events ?? [];
    analytics = {
      ...analytics,
      tab_switch_count: callDetails.tab_switch_count ?? 0,
      full_screen_events: callDetails.fullscreen_exit_count ?? 0,
      proctoring_events: proctoringEvents,
      camera_covered: proctoringEvents.some((e: any) => e.type === "camera_covered"),
    };
  }

  // ── Step 2: Generate call_analysis (summary, sentiments, completion) ────────
  let callAnalysis = callResponse.call_analysis;
  let callAnalysisFailed = false;
  let needsSave = false;

  if (!callAnalysis && transcript) {
    needsSave = true;
    try {
      const result = await callLlmEdgeFunction<{ callAnalysis: Record<string, unknown> }>(
        "generate_call_analysis",
        {
          transcript,
          ...(analytics?.overallScore !== undefined ? { overallScore: analytics.overallScore } : {}),
          ...(analytics?.overallFeedback ? { overallFeedback: analytics.overallFeedback } : {}),
        },
      );
      callAnalysis = result.callAnalysis;
      logger.info("Call analysis generated successfully");
    } catch (error) {
      callAnalysisFailed = true;
      logger.error("Call analysis generation failed for call");
    }
  }

  const succeeded = !analyticsFailed && !callAnalysisFailed;

  const updatedCallResponse = {
    ...callResponse,
    ...(callAnalysis ? { call_analysis: callAnalysis } : {}),
  };

  // Only mark processed_by_foloup true when both steps succeeded.
  // Leaving it false means the retry cron will pick this record up.
  if (!callDetails.is_analysed || needsSave) {
    await adminSave({
      details: updatedCallResponse,
      is_analysed: succeeded,
      processed_by_foloup: succeeded,
      ...(analytics ? { analytics, duration } : {}),
    });

    if (succeeded) {
      logger.info(`Call fully analysed and saved for call ${body.id}`);
    } else {
      logger.warn(
        `Analysis incomplete for call ${body.id} — analytics_failed=${analyticsFailed} call_analysis_failed=${callAnalysisFailed}`,
      );
    }
  }

  // ── Step 3: Notify DreamIT (only for real candidate responses) ──────────────
  if (
    succeeded &&
    callDetails.application_id &&
    !callDetails.dreamit_notified &&
    analytics &&
    !callDetails.is_test_response
  ) {
    const dreamitUrl = process.env.DREAMIT_URL;
    const secret = process.env.DREAMIT_FOLOUP_SECRET;
    const serviceRoleKey = process.env.DREAMIT_SUPABASE_SERVICE_ROLE_KEY;

    if (dreamitUrl && secret && serviceRoleKey) {
      try {
        const dreamitRes = await fetch(
          `${dreamitUrl}/functions/v1/process-speaking-test-results`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-foloup-secret": secret,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              applicationId: callDetails.application_id,
              analytics,
            }),
          },
        );

        if (dreamitRes.ok) {
          await adminSave({ dreamit_notified: true });
          logger.info(`DreamIT notified for application ${callDetails.application_id}`);
        } else {
          logger.error(`DreamIT notification failed with status ${dreamitRes.status}`);
        }
      } catch (err) {
        logger.error("DreamIT notification error");
      }
    }
  }

  return NextResponse.json(
    { callResponse: updatedCallResponse, analytics },
    { status: 200 },
  );
}
