import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Mistral } from "https://esm.sh/@mistralai/mistralai@1";

const MISTRAL_MODEL = Deno.env.get("MISTRAL_MODEL") || "mistral-large-latest";

const ANALYTICS_SYSTEM_PROMPT =
  "You are an expert interview evaluator. Analyze the interview transcript and return a JSON object with scores, feedback, and language proficiency metrics. IMPORTANT: Respond with valid JSON only.";

const CALL_ANALYSIS_SYSTEM_PROMPT =
  "You are an expert conversation analyst. Return a JSON object summarizing the call. IMPORTANT: Respond with valid JSON only.";

function log(level: "INFO" | "WARN" | "ERROR", msg: string, data?: unknown) {
  const entry: Record<string, unknown> = { ts: new Date().toISOString(), level, fn: "retry-analysis", msg };
  if (data !== undefined) entry.data = data;
  const out = JSON.stringify(entry);
  if (level === "ERROR") console.error(out);
  else if (level === "WARN") console.warn(out);
  else console.log(out);
}

function buildAnalyticsPrompt(transcript: string, questions: string): string {
  return `Analyze this interview transcript and return a JSON object with:
- overallScore (0-10)
- overallFeedback (string)
- communication: { score (0-10), feedback (string) }
- generalIntelligence (string)
- softSkillSummary (string)
- questionSummaries: array of { question, summary, questionTranscript, cefrLevel, pronunciationLevel, fluencyLevel, vocabularyLevel, grammarLevel }
- cefrLevel (A1/A2/B1/B2/C1/C2)
- cefrDescription (string)
- ieltsEstimate (string)
- pronunciationScore, fluencyScore, grammarScore, vocabularyScore, coherenceScore (0-10 each)
- pronunciationFeedback, fluencyFeedback, vocabularyFeedback, grammarFeedback, coherenceFeedback (strings)
- confidenceLevel (High/Medium/Low)
- engagementScore, problemSolvingScore, adaptabilityScore (0-10 each)

Interview questions:
${questions}

Transcript:
${transcript}`;
}

function buildCallAnalysisPrompt(
  transcript: string,
  overallScore?: number,
  overallFeedback?: string,
): string {
  return `Analyze this interview transcript and return a JSON object with:
- call_summary (string)
- user_sentiment (Positive/Neutral/Negative)
- agent_sentiment (Positive/Neutral/Negative)
- agent_task_completion_rating (Complete/Partial/Incomplete)
- agent_task_completion_rating_reason (string)
- call_completion_rating (Complete/Partial/Incomplete)
- call_completion_rating_reason (string)

${overallScore !== undefined ? `Overall score: ${overallScore}/10` : ""}
${overallFeedback ? `Overall feedback: ${overallFeedback}` : ""}

Transcript:
${transcript}`;
}

async function mistralComplete(
  mistral: Mistral,
  messages: Array<{ role: "system" | "user"; content: string }>,
  label: string,
  maxTokens?: number,
): Promise<string> {
  const request: any = {
    model: MISTRAL_MODEL,
    messages,
    responseFormat: { type: "json_object" },
    ...(maxTokens ? { maxTokens } : {}),
  };

  log("INFO", `Mistral request started`, { label, model: MISTRAL_MODEL, maxTokens, userPromptChars: messages[1]?.content?.length });
  const t0 = Date.now();

  try {
    const completion = await mistral.chat.complete(request);
    const content = (completion.choices?.[0]?.message?.content as string) || "{}";
    log("INFO", `Mistral request succeeded`, {
      label,
      durationMs: Date.now() - t0,
      responseChars: content.length,
      finishReason: completion.choices?.[0]?.finish_reason,
      usage: completion.usage,
    });
    return content;
  } catch (err: any) {
    log("WARN", `Mistral request failed, retrying without responseFormat`, {
      label,
      durationMs: Date.now() - t0,
      status: err?.status,
      message: err?.message,
    });

    // Some models reject responseFormat — retry without it
    if (err?.status === 400 || err?.message?.includes("responseFormat")) {
      const t1 = Date.now();
      const retryCompletion = await mistral.chat.complete({ ...request, responseFormat: undefined });
      const content = (retryCompletion.choices?.[0]?.message?.content as string) || "{}";
      log("INFO", `Mistral retry succeeded`, {
        label,
        durationMs: Date.now() - t1,
        responseChars: content.length,
        usage: retryCompletion.usage,
      });
      return content;
    }
    throw err;
  }
}

Deno.serve(async (_req) => {
  const fnStart = Date.now();
  log("INFO", "Function invoked");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const mistralApiKey = Deno.env.get("MISTRAL_API_KEY");
    const dreamitUrl = Deno.env.get("DREAMIT_URL");
    const foloupSecret = Deno.env.get("DREAMIT_FOLOUP_SECRET");
    const dreamitServiceRoleKey = Deno.env.get("DREAMIT_SUPABASE_SERVICE_ROLE_KEY");

    log("INFO", "Env vars loaded", {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      hasMistralApiKey: !!mistralApiKey,
      mistralModel: MISTRAL_MODEL,
      hasDreamitUrl: !!dreamitUrl,
      hasFoloupSecret: !!foloupSecret,
      hasDreamitServiceRoleKey: !!dreamitServiceRoleKey,
    });

    if (!supabaseUrl || !serviceRoleKey) {
      const msg = "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured";
      log("ERROR", msg);
      throw new Error(msg);
    }

    if (!mistralApiKey) {
      log("ERROR", "MISTRAL_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "MISTRAL_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const mistral = new Mistral({ apiKey: mistralApiKey });

    log("INFO", "Fetching pending responses from DB");
    const dbFetchStart = Date.now();
    const { data: responses, error } = await supabase
      .from("response")
      .select("call_id, interview_id, details, analytics, application_id, tab_switch_count, fullscreen_exit_count, proctoring_events, no_face_count, multiple_faces_count")
      .eq("processed_by_foloup", false)
      .eq("is_ended", true);

    log("INFO", "DB fetch complete", {
      durationMs: Date.now() - dbFetchStart,
      rowCount: responses?.length ?? 0,
      error: error?.message ?? null,
    });

    if (error) {
      throw new Error(`DB fetch error: ${error.message}`);
    }

    if (!responses || responses.length === 0) {
      log("INFO", "No pending analyses found, exiting early");
      return new Response(
        JSON.stringify({ message: "No pending analyses", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    log("INFO", `Processing ${responses.length} response(s)`);

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const callId = response.call_id;
      const appId = response.application_id ?? null;
      const iterLabel = `[${i + 1}/${responses.length}] call_id=${callId}`;

      log("INFO", `${iterLabel} Starting`, { interview_id: response.interview_id, application_id: appId });

      const transcript: string = response.details?.transcript || "";

      if (!transcript) {
        log("WARN", `${iterLabel} No transcript found, skipping`, { details_keys: Object.keys(response.details ?? {}) });
        failed++;
        continue;
      }

      log("INFO", `${iterLabel} Transcript found`, { transcriptChars: transcript.length });

      try {
        // Fetch interview questions
        log("INFO", `${iterLabel} Fetching interview questions`, { interview_id: response.interview_id });
        const interviewFetchStart = Date.now();
        const { data: interviewData, error: interviewError } = await supabase
          .from("interview")
          .select("questions")
          .eq("id", response.interview_id)
          .single();

        log("INFO", `${iterLabel} Interview fetch complete`, {
          durationMs: Date.now() - interviewFetchStart,
          questionCount: interviewData?.questions?.length ?? 0,
          error: interviewError?.message ?? null,
        });

        const questions: any[] = interviewData?.questions || [];
        const questionsText = questions
          .map((q: any, i: number) => `${i + 1}. ${q.question}`)
          .join("\n");

        // ── Step 1: Generate analytics ──────────────────────────────────────
        let analytics = response.analytics;
        if (!analytics) {
          log("INFO", `${iterLabel} Step 1: Generating analytics (no existing analytics)`);
          const content = await mistralComplete(
            mistral,
            [
              { role: "system", content: ANALYTICS_SYSTEM_PROMPT },
              { role: "user", content: buildAnalyticsPrompt(transcript, questionsText) },
            ],
            `${iterLabel}/analytics`,
            16000,
          );
          try {
            analytics = JSON.parse(content);
            analytics.mainInterviewQuestions = questions.map((q: any) => q.question);
            log("INFO", `${iterLabel} Analytics parsed`, {
              overallScore: analytics.overallScore,
              cefrLevel: analytics.cefrLevel,
              ieltsEstimate: analytics.ieltsEstimate,
              questionSummaryCount: analytics.questionSummaries?.length ?? 0,
            });
          } catch (parseErr) {
            log("ERROR", `${iterLabel} Failed to parse analytics JSON`, { raw: content.slice(0, 500) });
            throw parseErr;
          }
        } else {
          log("INFO", `${iterLabel} Step 1: Analytics already present, skipping Mistral call`);
        }

        // ── Step 2: Generate call_analysis ──────────────────────────────────
        let callAnalysis = response.details?.call_analysis;
        if (!callAnalysis) {
          log("INFO", `${iterLabel} Step 2: Generating call analysis`);
          const content = await mistralComplete(
            mistral,
            [
              { role: "system", content: CALL_ANALYSIS_SYSTEM_PROMPT },
              {
                role: "user",
                content: buildCallAnalysisPrompt(
                  transcript,
                  analytics?.overallScore,
                  analytics?.overallFeedback,
                ),
              },
            ],
            `${iterLabel}/call_analysis`,
          );
          try {
            callAnalysis = JSON.parse(content);
            log("INFO", `${iterLabel} Call analysis parsed`, {
              user_sentiment: callAnalysis.user_sentiment,
              call_completion_rating: callAnalysis.call_completion_rating,
            });
          } catch (parseErr) {
            log("ERROR", `${iterLabel} Failed to parse call_analysis JSON`, { raw: content.slice(0, 500) });
            throw parseErr;
          }
        } else {
          log("INFO", `${iterLabel} Step 2: Call analysis already present, skipping Mistral call`);
        }

        // Save results
        log("INFO", `${iterLabel} Saving results to DB`);
        const saveStart = Date.now();
        const { error: saveError } = await supabase
          .from("response")
          .update({
            analytics,
            details: { ...response.details, call_analysis: callAnalysis },
            is_analysed: true,
            processed_by_foloup: true,
          })
          .eq("call_id", callId);

        if (saveError) {
          log("ERROR", `${iterLabel} DB save failed`, { error: saveError.message, code: saveError.code });
          throw new Error(`DB save error: ${saveError.message}`);
        }
        log("INFO", `${iterLabel} DB save succeeded`, { durationMs: Date.now() - saveStart });

        // Notify DreamIT if applicable
        if (response.application_id && dreamitUrl && foloupSecret && dreamitServiceRoleKey) {
          log("INFO", `${iterLabel} Notifying DreamIT`, { application_id: appId, dreamitUrl });
          const dreamitStart = Date.now();
          const dreamitRes = await fetch(
            `${dreamitUrl}/functions/v1/process-speaking-test-results`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-foloup-secret": foloupSecret,
                "Authorization": `Bearer ${dreamitServiceRoleKey}`,
              },
              body: JSON.stringify({
                applicationId: response.application_id,
                analytics: {
                  ...analytics,
                  tab_switch_count: analytics?.tab_switch_count ?? response.tab_switch_count ?? 0,
                  full_screen_events: analytics?.full_screen_events ?? response.fullscreen_exit_count ?? 0,
                  proctoring_events: analytics?.proctoring_events ?? response.proctoring_events ?? [],
                  camera_covered: analytics?.camera_covered ??
                    (response.proctoring_events ?? []).some((e: any) => e.type === "camera_covered"),
                  no_face_count: analytics?.no_face_count ?? response.no_face_count ?? 0,
                  multiple_faces_count: analytics?.multiple_faces_count ?? response.multiple_faces_count ?? 0,
                },
              }),
            },
          );

          const dreamitStatus = dreamitRes.status;
          log("INFO", `${iterLabel} DreamIT responded`, {
            status: dreamitStatus,
            ok: dreamitRes.ok,
            durationMs: Date.now() - dreamitStart,
          });

          if (dreamitRes.ok) {
            const { error: notifyError } = await supabase
              .from("response")
              .update({ dreamit_notified: true })
              .eq("call_id", callId);

            if (notifyError) {
              log("WARN", `${iterLabel} Failed to set dreamit_notified flag`, { error: notifyError.message });
            } else {
              log("INFO", `${iterLabel} dreamit_notified flag set`);
            }
          } else {
            const body = await dreamitRes.text().catch(() => "(unreadable)");
            log("ERROR", `${iterLabel} DreamIT rejected request`, {
              application_id: appId,
              status: dreamitStatus,
              responseBody: body.slice(0, 500),
            });
          }
        } else {
          log("INFO", `${iterLabel} Skipping DreamIT notification`, {
            hasApplicationId: !!response.application_id,
            hasDreamitUrl: !!dreamitUrl,
            hasFoloupSecret: !!foloupSecret,
            hasDreamitServiceRoleKey: !!dreamitServiceRoleKey,
          });
        }

        succeeded++;
        log("INFO", `${iterLabel} Completed successfully`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        log("ERROR", `${iterLabel} Failed`, { error: msg, stack });
        failed++;
      }
    }

    const summary = { processed: responses.length, succeeded, failed, totalDurationMs: Date.now() - fnStart };
    log("INFO", "Function complete", summary);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log("ERROR", "Fatal error", { error: message, stack, totalDurationMs: Date.now() - fnStart });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
