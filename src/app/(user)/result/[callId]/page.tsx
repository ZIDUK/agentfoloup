"use client";

import { useEffect, useState } from "react";
import { ResponseService } from "@/services/responses.service";
import { InterviewService } from "@/services/interviews.service";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";

type Props = {
  params: {
    callId: string;
  };
};

const CEFR_LABELS: Record<string, string> = {
  A1: "Beginner",
  A2: "Elementary",
  "A2+": "Elementary+",
  B1: "Intermediate",
  "B1+": "Intermediate+",
  B2: "Upper Intermediate",
  "B2+": "Upper Intermediate+",
  C1: "Advanced",
  "C1+": "Advanced+",
  C2: "Proficient",
};

function CefrBadge({ level }: { level: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold">
      {level}
      {CEFR_LABELS[level] && (
        <span className="text-indigo-500 font-normal">· {CEFR_LABELS[level]}</span>
      )}
    </span>
  );
}

function SkillRow({ label, feedback }: { label: string; feedback?: string }) {
  if (!feedback) return null;
  return (
    <div className="border border-indigo-100 rounded-lg p-4 bg-white">
      <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-gray-700 text-sm leading-relaxed">{feedback}</p>
    </div>
  );
}

type TranscriptEntry = { role: "agent" | "user"; content: string };

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const isAgent = entry.role === "agent";
  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isAgent
            ? "bg-gray-100 text-gray-800 rounded-tl-sm"
            : "bg-indigo-600 text-white rounded-tr-sm"
        }`}
      >
        <p className={`text-[10px] font-semibold mb-1 ${isAgent ? "text-gray-400" : "text-indigo-200"}`}>
          {isAgent ? "Interviewer" : "You"}
        </p>
        {entry.content}
      </div>
    </div>
  );
}

export default function ResultPage({ params }: Props) {
  const [interviewName, setInterviewName] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await ResponseService.getResponseByCallId(params.callId);
        if (response?.interview_id) {
          const interview = await InterviewService.getInterviewById(response.interview_id);
          setInterviewName(interview?.name ?? null);
        }
        if (response?.is_analysed && response.analytics) {
          setAnalytics(response.analytics);
        }
        if (response?.details?.transcript_object) {
          setTranscript(response.details.transcript_object);
        }
      } catch {
        // fetch failure handled by fallback UI
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.callId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoaderWithText />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="flex flex-col items-center text-center p-10 max-w-lg">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">Interview Complete</h1>
          {interviewName && <p className="text-gray-500 text-lg mb-2">{interviewName}</p>}
          <p className="text-gray-600 mt-2">
            Thank you for completing the interview. Your responses have been recorded and will be reviewed shortly.
          </p>
        </div>
      </div>
    );
  }

  const ep = analytics.englishProficiency ?? {};
  const skills = [
    { label: "Pronunciation", feedback: ep.pronunciationFeedback },
    { label: "Fluency", feedback: ep.fluencyFeedback },
    { label: "Vocabulary", feedback: ep.vocabularyFeedback },
    { label: "Grammar", feedback: ep.grammarFeedback },
    { label: "Coherence", feedback: ep.coherenceFeedback },
  ];
  const hasSkillFeedback = skills.some((s) => s.feedback);
  const questionSummaries: any[] = analytics.questionSummaries ?? [];
  const hasTranscript = transcript.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Your Interview Results</h1>
          {interviewName && <p className="text-gray-500 mt-1">{interviewName}</p>}
        </div>

        {/* English Proficiency */}
        {ep.cefrLevel && (
          <div className="bg-white border border-indigo-100 rounded-xl p-5 text-center shadow-sm">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-3">
              English Proficiency Level
            </p>
            <CefrBadge level={ep.cefrLevel} />
            {ep.cefrDescription && (
              <p className="text-gray-600 text-sm mt-3 leading-relaxed">{ep.cefrDescription}</p>
            )}
            {ep.ieltsEstimate && (
              <p className="text-gray-500 text-sm mt-2">
                IELTS equivalent:{" "}
                <span className="font-semibold text-indigo-600">{ep.ieltsEstimate}</span>
              </p>
            )}
          </div>
        )}

        {/* Overall Feedback */}
        {analytics.overallFeedback && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Overall Feedback</p>
            <p className="text-gray-700 text-sm leading-relaxed">{analytics.overallFeedback}</p>
          </div>
        )}

        {/* Skill Breakdown */}
        {hasSkillFeedback && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Language Skills</p>
            {skills.map((s) => (
              <SkillRow key={s.label} label={s.label} feedback={s.feedback} />
            ))}
          </div>
        )}

        {/* Question Summaries */}
        {questionSummaries.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Question Summaries</p>
            {questionSummaries.map((q: any, i: number) => (
              <div key={i} className="border border-gray-100 rounded-lg p-4 bg-white">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  Question {i + 1}
                </p>
                <p className="font-medium text-gray-800 mb-2 text-sm">{q.question}</p>
                {q.summary && <p className="text-gray-600 text-sm leading-relaxed">{q.summary}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Transcript */}
        {hasTranscript && (
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 pt-4 pb-3 border-b border-gray-100">
              Interview Transcript
            </p>
            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {transcript.map((entry, i) => (
                <TranscriptBubble key={i} entry={entry} />
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pt-2 pb-6">
          Thank you for completing the interview. Your responses have been recorded and will be reviewed by the team.
        </p>
      </div>
    </div>
  );
}
