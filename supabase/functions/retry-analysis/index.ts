import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Mistral from "https://esm.sh/@mistralai/mistralai@1";

const MISTRAL_MODEL = Deno.env.get("MISTRAL_MODEL") || "mistral-large-latest";

const ANALYTICS_SYSTEM_PROMPT = `You are an expert interview evaluator. Analyze the interview transcript and return a JSON object with scores, feedback, and language proficiency metrics.`;

const CALL_ANALYSIS_SYSTEM_PROMPT = `You are an expert conversation analyst. Return a JSON object summarizing the call.`;

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

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mistralApiKey = Deno.env.get("MISTRAL_API_KEY");
  const dreamitUrl = Deno.env.get("DREAMIT_URL");
  const foloupSecret = Deno.env.get("DREAMIT_FOLOUP_SECRET");
  const dreamitServiceRoleKey = Deno.env.get("DREAMIT_SUPABASE_SERVICE_ROLE_KEY");

  if (!mistralApiKey) {
    return new Response(
      JSON.stringify({ error: "MISTRAL_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const mistral = new Mistral({ apiKey: mistralApiKey });

  // Fetch all ended responses that haven't been fully analysed yet
  const { data: responses, error } = await supabase
    .from("response")
    .select("call_id, interview_id, details, analytics, application_id")
    .eq("processed_by_foloup", false)
    .eq("is_ended", true);

  if (error) {
    console.error("Error fetching failed responses:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!responses || responses.length === 0) {
    return new Response(
      JSON.stringify({ message: "No failed analyses to retry", processed: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  let succeeded = 0;
  let failed = 0;

  for (const response of responses) {
    const transcript: string =
      response.details?.transcript || "";

    if (!transcript) {
      console.warn(`No transcript for call ${response.call_id}, skipping`);
      failed++;
      continue;
    }

    try {
      // Fetch interview questions
      const { data: interviewData } = await supabase
        .from("interview")
        .select("questions")
        .eq("id", response.interview_id)
        .single();

      const questions: any[] = interviewData?.questions || [];
      const questionsText = questions
        .map((q: any, i: number) => `${i + 1}. ${q.question}`)
        .join("\n");

      // ── Step 1: Regenerate analytics ──────────────────────────────────────
      let analytics = response.analytics;
      if (!analytics) {
        const analyticsCompletion = await mistral.chat.complete({
          model: MISTRAL_MODEL,
          messages: [
            { role: "system", content: ANALYTICS_SYSTEM_PROMPT },
            { role: "user", content: buildAnalyticsPrompt(transcript, questionsText) },
          ],
          responseFormat: { type: "json_object" },
          maxTokens: 16000,
        });

        const content = analyticsCompletion.choices?.[0]?.message?.content || "{}";
        analytics = JSON.parse(content as string);
        analytics.mainInterviewQuestions = questions.map((q: any) => q.question);
      }

      // ── Step 2: Regenerate call_analysis ──────────────────────────────────
      let callAnalysis = response.details?.call_analysis;
      if (!callAnalysis) {
        const callAnalysisCompletion = await mistral.chat.complete({
          model: MISTRAL_MODEL,
          messages: [
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
          responseFormat: { type: "json_object" },
        });

        const content = callAnalysisCompletion.choices?.[0]?.message?.content || "{}";
        callAnalysis = JSON.parse(content as string);
      }

      // Save successful results
      await supabase
        .from("response")
        .update({
          analytics,
          details: { ...response.details, call_analysis: callAnalysis },
          is_analysed: true,
          processed_by_foloup: true,
        })
        .eq("call_id", response.call_id);

      // Notify DreamIT if applicable
      if (
        response.application_id &&
        dreamitUrl &&
        foloupSecret &&
        dreamitServiceRoleKey
      ) {
        const dreamitRes = await fetch(
          `${dreamitUrl}/functions/v1/process-speaking-test-results`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-foloup-secret": foloupSecret,
              Authorization: `Bearer ${dreamitServiceRoleKey}`,
            },
            body: JSON.stringify({
              applicationId: response.application_id,
              analytics,
            }),
          },
        );

        if (dreamitRes.ok) {
          await supabase
            .from("response")
            .update({ dreamit_notified: true })
            .eq("call_id", response.call_id);
        } else {
          console.error(
            `DreamIT rejected application ${response.application_id}: ${dreamitRes.status}`,
          );
        }
      }

      succeeded++;
    } catch (err) {
      console.error(`Retry failed for call ${response.call_id}:`, err);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ processed: responses.length, succeeded, failed }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
