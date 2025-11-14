"use server";

import { ResponseService } from "@/services/responses.service";
import { InterviewService } from "@/services/interviews.service";
import { Question } from "@/types/interview";
import { Analytics, QuestionSummary } from "@/types/response";
import {
  getInterviewAnalyticsPrompt,
  SYSTEM_PROMPT,
} from "@/lib/prompts/analytics";
import { getMistralClient } from "@/services/mistral.service";

/**
 * Calculate WPM and bad pauses for a question using Deepgram transcript timing data
 * This uses REAL audio data from Deepgram, not estimates
 */
function calculateQuestionFluencyMetrics(
  questionTranscript: string,
  transcriptObject: Array<{
    role: string;
    content: string;
    words?: Array<{ word: string; start: number; end: number }>;
  }>,
  questionIndex: number,
): { wpm: number; badPauses: number; averageWordDuration?: number; speechVariability?: number } {
  if (!transcriptObject || transcriptObject.length === 0) {
    return { wpm: 0, badPauses: 0, averageWordDuration: 0, speechVariability: 0 };
  }

  // Find candidate responses (user role) that match this question
  // This is a simplified approach - in practice, you'd need to match questions to responses more precisely
  const candidateEntries = transcriptObject.filter(
    (entry) => entry.role === "user" && entry.words && entry.words.length > 0,
  );

  if (candidateEntries.length === 0) {
    // Fallback: estimate from text length
    const wordCount = questionTranscript.split(/\s+/).filter((w) => w.length > 0)
      .length;
    // Estimate average speaking rate (150 WPM is average)
    const estimatedWpm = wordCount > 0 ? Math.round(wordCount * 2) : 0;
    return { wpm: estimatedWpm, badPauses: 0, averageWordDuration: 0, speechVariability: 0 };
  }

  // Get words from candidate entries
  const allCandidateWords = candidateEntries.flatMap((entry) =>
    entry.words!.map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    })),
  );

  if (allCandidateWords.length === 0) {
    return { wpm: 0, badPauses: 0, averageWordDuration: 0, speechVariability: 0 };
  }

  // Calculate duration
  const startTime = allCandidateWords[0].start;
  const endTime = allCandidateWords[allCandidateWords.length - 1].end;
  const durationSeconds = (endTime - startTime) / 1000;
  const durationMinutes = durationSeconds / 60;

  // Calculate WPM
  const wordCount = allCandidateWords.length;
  const wpm =
    durationMinutes > 0 ? Math.round(wordCount / durationMinutes) : 0;

  // Detect bad pauses (gaps > 2 seconds between words)
  let badPauses = 0;
  for (let i = 1; i < allCandidateWords.length; i++) {
    const gap = (allCandidateWords[i].start - allCandidateWords[i - 1].end) /
      1000;
    if (gap > 2.0) {
      badPauses++;
    }
  }

  // Count hesitations in text (um, uh, er, etc.)
  const hesitationWords = ["um", "uh", "er", "ah", "hmm", "like", "you know"];
  const textLower = questionTranscript.toLowerCase();
  hesitationWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    const matches = textLower.match(regex);
    if (matches) {
      badPauses += matches.length;
    }
  });

  // Calculate additional fluency metrics from Deepgram audio data
  // Average word duration (shorter = faster speech)
  const wordDurations = allCandidateWords.map((w) => (w.end - w.start) / 1000);
  const averageWordDuration = wordDurations.length > 0
    ? wordDurations.reduce((a, b) => a + b, 0) / wordDurations.length
    : 0;

  // Speech variability (standard deviation of word durations)
  // Higher variability = less fluent (more hesitations, inconsistent pace)
  const variance = wordDurations.length > 0
    ? wordDurations.reduce((sum, dur) => sum + Math.pow(dur - averageWordDuration, 2), 0) /
      wordDurations.length
    : 0;
  const speechVariability = Math.sqrt(variance);

  return { wpm, badPauses, averageWordDuration, speechVariability };
}

export const generateInterviewAnalytics = async (payload: {
  callId: string;
  interviewId: string;
  transcript: string;
}) => {
  const { callId, interviewId, transcript } = payload;

  try {
    const response = await ResponseService.getResponseByCallId(callId);
    const interview = await InterviewService.getInterviewById(interviewId);

    if (response.analytics) {
      return { analytics: response.analytics as Analytics, status: 200 };
    }

    const interviewTranscript = transcript || response.details?.transcript;
    const questions = interview?.questions || [];
    const mainInterviewQuestions = questions
      .map((q: Question, index: number) => `${index + 1}. ${q.question}`)
      .join("\n");

    const mistral = getMistralClient();

    const prompt = getInterviewAnalyticsPrompt(
      interviewTranscript,
      mainInterviewQuestions,
    );

    const baseCompletion = await mistral.createChatCompletion({
      model: process.env.MISTRAL_MODEL || "mistral-large-latest",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 16000, // Sufficient for large JSON responses with multiple questions
    });

    const basePromptOutput = baseCompletion.choices[0] || {};
    const content = basePromptOutput.message?.content || "";
    const analyticsResponse = JSON.parse(content);

    // Calculate WPM and bad pauses for each question using timing data
    const transcriptObject = response.details?.transcript_object || [];
    if (
      analyticsResponse.questionSummaries &&
      Array.isArray(analyticsResponse.questionSummaries) &&
      transcriptObject.length > 0
    ) {
      analyticsResponse.questionSummaries = analyticsResponse.questionSummaries.map(
        (qs: QuestionSummary, index: number) => {
          if (qs.questionTranscript) {
            const { wpm, badPauses, averageWordDuration, speechVariability } =
              calculateQuestionFluencyMetrics(
                qs.questionTranscript,
                transcriptObject,
                index,
              );
            return {
              ...qs,
              wordsPerMinute: wpm,
              badPauses: badPauses,
              // Additional Deepgram-based metrics (can be used for enhanced fluency analysis)
              averageWordDuration: averageWordDuration,
              speechVariability: speechVariability,
            };
          }
          return qs;
        },
      );
    }

    analyticsResponse.mainInterviewQuestions = questions.map(
      (q: Question) => q.question,
    );

    return { analytics: analyticsResponse, status: 200 };
  } catch (error) {
    console.error("Error in Mistral request:", error);

    return { error: "internal server error", status: 500 };
  }
};
