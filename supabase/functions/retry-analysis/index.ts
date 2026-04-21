import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBedrock, getBedrockConfig } from "../_shared/bedrock.ts";
import { buildPhoenixLlmTraceBody, sendPhoenixOtlp } from "../_shared/phoenix_otlp.ts";

// Heavy model for deep analytics, light model for call summary/sentiment
const MODEL_HEAVY = "openai.gpt-oss-safeguard-120b";
const MODEL_LIGHT = "openai.gpt-oss-safeguard-20b";

const ANALYTICS_SYSTEM_PROMPT =
  "You are an expert interview evaluator. Analyze the interview transcript and return a JSON object with scores, feedback, and language proficiency metrics. IMPORTANT: Respond with valid JSON only. No markdown, no code fences.";

const CALL_ANALYSIS_SYSTEM_PROMPT =
  "You are an expert conversation analyst. Return a JSON object summarizing the call. IMPORTANT: Respond with valid JSON only. No markdown, no code fences.";

const CALL_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    call_summary: { type: "string" },
    user_sentiment: { type: "string" },
    agent_sentiment: { type: "string" },
    agent_task_completion_rating: { type: "string" },
    agent_task_completion_rating_reason: { type: "string" },
    call_completion_rating: { type: "string" },
    call_completion_rating_reason: { type: "string" },
  },
  required: [
    "call_summary",
    "user_sentiment",
    "agent_sentiment",
    "agent_task_completion_rating",
    "agent_task_completion_rating_reason",
    "call_completion_rating",
    "call_completion_rating_reason",
  ],
};

function log(level: "INFO" | "WARN" | "ERROR", msg: string, data?: unknown) {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    fn: "retry-analysis",
    msg,
  };
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

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

Deno.serve(async (_req) => {
  const fnStart = Date.now();
  log("INFO", "Function invoked");

  const phoenixBase = Deno.env.get("PHOENIX_URL")?.trim();
  const phoenixProject = Deno.env.get("PHOENIX_PROJECT")?.trim();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const dreamitUrl = Deno.env.get("DREAMIT_URL");
    const foloupSecret = Deno.env.get("DREAMIT_FOLOUP_SECRET");
    const dreamitServiceRoleKey = Deno.env.get("DREAMIT_SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      const msg = "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured";
      log("ERROR", msg);
      throw new Error(msg);
    }

    let bedrockConfig;
    try {
      bedrockConfig = getBedrockConfig();
    } catch {
      log("ERROR", "AWS Bedrock not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    log("INFO", "Env vars loaded", {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      hasDreamitUrl: !!dreamitUrl,
      hasFoloupSecret: !!foloupSecret,
      hasDreamitServiceRoleKey: !!dreamitServiceRoleKey,
      heavyModel: MODEL_HEAVY,
      lightModel: MODEL_LIGHT,
    });

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    log("INFO", "Fetching pending responses from DB");
    const dbFetchStart = Date.now();
    const { data: responses, error } = await supabase
      .from("response")
      .select("call_id, interview_id, details, analytics, application_id")
      .eq("processed_by_foloup", false)
      .eq("is_ended", true);

    log("INFO", "DB fetch complete", {
      durationMs: Date.now() - dbFetchStart,
      rowCount: responses?.length ?? 0,
      error: error?.message ?? null,
    });

    if (error) throw new Error(`DB fetch error: ${error.message}`);

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

      log("INFO", `${iterLabel} Starting`, {
        interview_id: response.interview_id,
        application_id: appId,
      });

      const transcript: string = response.details?.transcript || "";

      if (!transcript) {
        log("WARN", `${iterLabel} No transcript found, skipping`, {
          details_keys: Object.keys(response.details ?? {}),
        });
        failed++;
        continue;
      }

      log("INFO", `${iterLabel} Transcript found`, { transcriptChars: transcript.length });

      try {
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

        // ── Step 1: Generate analytics ────────────────────────────────────────
        let analytics = response.analytics;
        if (!analytics) {
          log("INFO", `${iterLabel} Step 1: Generating analytics`);

          const analyticsPrompt = buildAnalyticsPrompt(transcript, questionsText);
          const rootStartMs = Date.now();
          let llmStartMs = 0;
          let llmEndMs = 0;
          let analyticsText = "";
          let analyticsUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined;
          let analyticsError: string | undefined;

          try {
            llmStartMs = Date.now();
            const { text, usage } = await callBedrock(
              bedrockConfig,
              MODEL_HEAVY,
              analyticsPrompt,
              {
                systemPrompt: ANALYTICS_SYSTEM_PROMPT,
                temperature: 0.3,
                maxTokens: 16000,
              },
            );
            analyticsText = text;
            analyticsUsage = usage;
          } catch (e: any) {
            analyticsError = e?.message ?? String(e);
            throw e;
          } finally {
            llmEndMs = Date.now();
            if (phoenixBase) {
              const traceBody = buildPhoenixLlmTraceBody({
                serviceName: "retry-analysis",
                projectName: phoenixProject ?? "foloup",
                rootSpanName: "retry-analysis.request",
                llmSpanName: "bedrock.converse",
                scopeName: "retry-analysis",
                fieldType: "generate_analytics",
                model: MODEL_HEAVY,
                promptPreview: analyticsPrompt.slice(0, 8192),
                outputPreview: analyticsText.slice(0, 8192),
                promptLen: analyticsPrompt.length,
                outputLen: analyticsText.length,
                temperature: 0.3,
                maxOutputTokens: 16000,
                tokenPrompt: analyticsUsage?.inputTokens,
                tokenCompletion: analyticsUsage?.outputTokens,
                tokenTotal: analyticsUsage?.totalTokens,
                rootStartMs,
                rootEndMs: Date.now(),
                llmStartMs,
                llmEndMs,
                llmError: analyticsError,
              });
              await sendPhoenixOtlp(phoenixBase, traceBody);
            }
          }

          try {
            analytics = JSON.parse(extractJson(analyticsText));
            analytics.mainInterviewQuestions = questions.map((q: any) => q.question);
            log("INFO", `${iterLabel} Analytics parsed`, {
              overallScore: analytics.overallScore,
              cefrLevel: analytics.cefrLevel,
              questionSummaryCount: analytics.questionSummaries?.length ?? 0,
            });
          } catch (parseErr) {
            log("ERROR", `${iterLabel} Failed to parse analytics JSON`, {
              raw: analyticsText.slice(0, 500),
            });
            throw parseErr;
          }
        } else {
          log("INFO", `${iterLabel} Step 1: Analytics already present, skipping`);
        }

        // ── Step 2: Generate call_analysis ────────────────────────────────────
        let callAnalysis = response.details?.call_analysis;
        if (!callAnalysis) {
          log("INFO", `${iterLabel} Step 2: Generating call analysis`);

          const callPrompt = buildCallAnalysisPrompt(
            transcript,
            analytics?.overallScore,
            analytics?.overallFeedback,
          );
          const rootStartMs = Date.now();
          let llmStartMs = 0;
          let llmEndMs = 0;
          let callText = "";
          let callUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined;
          let callError: string | undefined;

          try {
            llmStartMs = Date.now();
            const { text, usage } = await callBedrock(
              bedrockConfig,
              MODEL_LIGHT,
              callPrompt,
              {
                systemPrompt: CALL_ANALYSIS_SYSTEM_PROMPT,
                temperature: 0.3,
                maxTokens: 1024,
                responseSchema: CALL_ANALYSIS_SCHEMA,
              },
            );
            callText = text;
            callUsage = usage;
          } catch (e: any) {
            callError = e?.message ?? String(e);
            throw e;
          } finally {
            llmEndMs = Date.now();
            if (phoenixBase) {
              const traceBody = buildPhoenixLlmTraceBody({
                serviceName: "retry-analysis",
                projectName: phoenixProject ?? "foloup",
                rootSpanName: "retry-analysis.request",
                llmSpanName: "bedrock.converse",
                scopeName: "retry-analysis",
                fieldType: "generate_call_analysis",
                model: MODEL_LIGHT,
                promptPreview: callPrompt.slice(0, 8192),
                outputPreview: callText.slice(0, 8192),
                promptLen: callPrompt.length,
                outputLen: callText.length,
                temperature: 0.3,
                maxOutputTokens: 1024,
                tokenPrompt: callUsage?.inputTokens,
                tokenCompletion: callUsage?.outputTokens,
                tokenTotal: callUsage?.totalTokens,
                rootStartMs,
                rootEndMs: Date.now(),
                llmStartMs,
                llmEndMs,
                llmError: callError,
              });
              await sendPhoenixOtlp(phoenixBase, traceBody);
            }
          }

          try {
            callAnalysis = JSON.parse(callText);
            log("INFO", `${iterLabel} Call analysis parsed`, {
              user_sentiment: callAnalysis.user_sentiment,
              call_completion_rating: callAnalysis.call_completion_rating,
            });
          } catch (parseErr) {
            log("ERROR", `${iterLabel} Failed to parse call_analysis JSON`, {
              raw: callText.slice(0, 500),
            });
            throw parseErr;
          }
        } else {
          log("INFO", `${iterLabel} Step 2: Call analysis already present, skipping`);
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
          log("ERROR", `${iterLabel} DB save failed`, {
            error: saveError.message,
            code: saveError.code,
          });
          throw new Error(`DB save error: ${saveError.message}`);
        }
        log("INFO", `${iterLabel} DB save succeeded`, { durationMs: Date.now() - saveStart });

        // Notify DreamIT if applicable
        if (response.application_id && dreamitUrl && foloupSecret && dreamitServiceRoleKey) {
          log("INFO", `${iterLabel} Notifying DreamIT`, {
            application_id: appId,
            dreamitUrl,
          });
          const dreamitStart = Date.now();
          const dreamitRes = await fetch(
            `${dreamitUrl}/functions/v1/process-speaking-test-results`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-foloup-secret": foloupSecret,
                Authorization: `Bearer ${dreamitServiceRoleKey}`,
              },
              body: JSON.stringify({ applicationId: response.application_id, analytics }),
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
              log("WARN", `${iterLabel} Failed to set dreamit_notified flag`, {
                error: notifyError.message,
              });
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

    const summary = {
      processed: responses.length,
      succeeded,
      failed,
      totalDurationMs: Date.now() - fnStart,
    };
    log("INFO", "Function complete", summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log("ERROR", "Fatal error", {
      error: message,
      stack,
      totalDurationMs: Date.now() - fnStart,
    });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
