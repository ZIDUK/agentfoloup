"use server";

import { ResponseService } from "@/services/responses.service";
import { InterviewService } from "@/services/interviews.service";
import { Question } from "@/types/interview";
import { Analytics, QuestionSummary } from "@/types/response";
import { callLlmEdgeFunction } from "@/lib/llm-client";

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
  _questionIndex: number,
): { wpm: number; badPauses: number; averageWordDuration?: number; speechVariability?: number } {
  if (!transcriptObject || transcriptObject.length === 0) {
    return { wpm: 0, badPauses: 0, averageWordDuration: 0, speechVariability: 0 };
  }

  const candidateEntries = transcriptObject.filter(
    (entry) => entry.role === "user" && entry.words && entry.words.length > 0,
  );

  if (candidateEntries.length === 0) {
    const wordCount = questionTranscript.split(/\s+/).filter((w) => w.length > 0).length;
    const estimatedWpm = wordCount > 0 ? Math.round(wordCount * 2) : 0;
    return { wpm: estimatedWpm, badPauses: 0, averageWordDuration: 0, speechVariability: 0 };
  }

  const allCandidateWords = candidateEntries.flatMap((entry) =>
    entry.words!.map((w) => ({ word: w.word, start: w.start, end: w.end })),
  );

  if (allCandidateWords.length === 0) {
    return { wpm: 0, badPauses: 0, averageWordDuration: 0, speechVariability: 0 };
  }

  const startTime = allCandidateWords[0].start;
  const endTime = allCandidateWords[allCandidateWords.length - 1].end;
  const durationSeconds = (endTime - startTime) / 1000;
  const durationMinutes = durationSeconds / 60;

  const wordCount = allCandidateWords.length;
  const wpm = durationMinutes > 0 ? Math.round(wordCount / durationMinutes) : 0;

  let badPauses = 0;
  for (let i = 1; i < allCandidateWords.length; i++) {
    const gap = (allCandidateWords[i].start - allCandidateWords[i - 1].end) / 1000;
    if (gap > 2.0) badPauses++;
  }

  const hesitationWords = ["um", "uh", "er", "ah", "hmm", "like", "you know"];
  const textLower = questionTranscript.toLowerCase();
  hesitationWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    const matches = textLower.match(regex);
    if (matches) badPauses += matches.length;
  });

  const wordDurations = allCandidateWords.map((w) => (w.end - w.start) / 1000);
  const averageWordDuration =
    wordDurations.length > 0
      ? wordDurations.reduce((a, b) => a + b, 0) / wordDurations.length
      : 0;

  const variance =
    wordDurations.length > 0
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
  existingAnalytics?: Analytics | null;
  transcriptObject?: any[];
  questions?: Question[];
}) => {
  const {
    callId,
    interviewId,
    transcript,
    existingAnalytics,
    transcriptObject: passedTranscriptObject,
    questions: passedQuestions,
  } = payload;

  try {
    if (existingAnalytics) {
      return { analytics: existingAnalytics, status: 200 };
    }

    let questions = passedQuestions;
    if (!questions) {
      const interview = await InterviewService.getInterviewById(interviewId);
      questions = interview?.questions || [];
    }

    let transcriptObject = passedTranscriptObject;
    if (!transcriptObject) {
      const response = await ResponseService.getResponseByCallId(callId);
      transcriptObject = response?.details?.transcript_object || [];
    }

    const questionsText = (questions ?? [])
      .map((q: Question, index: number) => `${index + 1}. ${q.question}`)
      .join("\n");

    const result = await callLlmEdgeFunction<{ analytics: Analytics }>(
      "generate_analytics",
      { transcript, questionsText },
    );

    const analyticsResponse = result.analytics as any;

    if (
      analyticsResponse.questionSummaries &&
      Array.isArray(analyticsResponse.questionSummaries) &&
      transcriptObject.length > 0
    ) {
      analyticsResponse.questionSummaries = analyticsResponse.questionSummaries.map(
        (qs: QuestionSummary, index: number) => {
          if (qs.questionTranscript) {
            const { wpm, badPauses, averageWordDuration, speechVariability } =
              calculateQuestionFluencyMetrics(qs.questionTranscript, transcriptObject ?? [], index);
            return { ...qs, wordsPerMinute: wpm, badPauses, averageWordDuration, speechVariability };
          }
          return qs;
        },
      );
    }

    analyticsResponse.mainInterviewQuestions = (questions ?? []).map((q: Question) => q.question);

    return { analytics: analyticsResponse, status: 200 };
  } catch (error) {
    console.error("Error in analytics generation:", error);
    return { error: "internal server error", status: 500 };
  }
};
