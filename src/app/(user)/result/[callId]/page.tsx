"use client";

import { useEffect, useState } from "react";
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

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

const CEFR_COLORS: Record<string, string> = {
  A1: "bg-destructive",
  A2: "bg-warning", // DS: closest token — no orange semantic token
  B1: "bg-warning",
  B2: "bg-success",
  C1: "bg-info", // DS: closest token — no teal semantic token
  C2: "bg-primary",
};

function CefrScale({ level }: { level: string }) {
  const baseLevel = level.replace("+", "");
  const activeIndex = CEFR_ORDER.indexOf(baseLevel);

  return (
    <div className="mt-5">
      <div className="flex items-end gap-1.5 justify-center">
        {CEFR_ORDER.map((l, i) => {
          const isActive = l === baseLevel;
          const isPast = i < activeIndex;
          return (
            <div key={l} className="flex flex-col items-center gap-1.5">
              <div
                className={`rounded-md transition-all ${
                  isActive
                    ? `${CEFR_COLORS[l]} w-9 h-9 ring-2 ring-offset-2 ring-primary shadow-md`
                    : isPast
                    ? `${CEFR_COLORS[l]} w-7 h-7 opacity-60`
                    : "bg-muted w-7 h-7"
                } flex items-center justify-center`}
              >
                <span
                  className={`text-xs font-bold ${
                    isActive || isPast ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {l}
                </span>
              </div>
              {isActive && (
                <span className="text-[10px] font-semibold text-foreground leading-none">
                  You
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SKILL_CONFIG: Record<string, { color: string; bg: string; icon: JSX.Element }> = {
  Pronunciation: {
    color: "text-info",
    bg: "bg-info-light",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  Fluency: {
    color: "text-success",
    bg: "bg-success-light",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  Vocabulary: {
    color: "text-primary", // DS: closest token — no purple semantic token
    bg: "bg-primary/10",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  Grammar: {
    color: "text-success", // DS: closest token — no emerald semantic token
    bg: "bg-success-light",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  Coherence: {
    color: "text-warning", // DS: closest token — no orange semantic token
    bg: "bg-warning-light",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
};

function SkillCard({ label, feedback }: { label: string; feedback: string }) {
  const cfg = SKILL_CONFIG[label];
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${cfg.bg} ${cfg.color}`}>
          {cfg.icon}
        </span>
        <p className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>{label}</p>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">{feedback}</p>
    </div>
  );
}

type TranscriptEntry = { role: "agent" | "user"; content: string };

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const isAgent = entry.role === "agent";
  return (
    <div className={`flex gap-2.5 ${isAgent ? "justify-start" : "flex-row-reverse justify-start"}`}>
      <div
        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${
          isAgent ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
        }`}
      >
        {isAgent ? "AI" : "You"}
      </div>
      <div
        className={`max-w-[76%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isAgent
            ? "bg-muted text-foreground rounded-tl-none"
            : "bg-primary text-primary-foreground rounded-tr-none"
        }`}
      >
        {entry.content}
      </div>
    </div>
  );
}

function TranscriptSection({ transcript }: { transcript: TranscriptEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Interview Transcript
          </p>
          <span className="text-xs text-muted-foreground">· {transcript.length} messages</span>
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-border p-4 space-y-3 max-h-[480px] overflow-y-auto">
          {transcript.map((entry, i) => (
            <TranscriptBubble key={i} entry={entry} />
          ))}
        </div>
      )}
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
        const rRes = await fetch(`/api/responses/${params.callId}`);
        const response = await rRes.json();
        if (response?.interview_id) {
          const iRes = await fetch(`/api/interviews/${response.interview_id}`);
          const interview = await iRes.json();
          setInterviewName(interview?.name ?? null);
        }
        if (response?.analytics) {
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
      <div className="min-h-screen bg-primary flex items-center justify-center px-4">
        <div className="bg-card rounded-2xl p-10 max-w-md w-full text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Interview Complete</h1>
          {interviewName && <p className="text-brand-700 font-medium mb-3">{interviewName}</p>}
          <p className="text-muted-foreground text-sm leading-relaxed">
            Thank you for completing the interview. Your responses have been recorded and will be reviewed shortly.
          </p>
        </div>
      </div>
    );
  }

  // Support both old nested format (analytics.englishProficiency.*) and new flat format
  const ep = analytics.englishProficiency ?? analytics;
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
    <div className="min-h-screen bg-background">

      {/* Hero banner */}
      <div className="bg-primary px-4 pt-12 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 rounded-full bg-primary-foreground/20 ring-2 ring-primary-foreground/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground mb-1">Your Interview Results</h1>
          {interviewName && (
            <p className="text-primary-foreground/70 text-base mt-1">{interviewName}</p>
          )}
          <p className="text-primary-foreground/80 text-sm mt-2">Your analysis is ready</p>
        </div>
      </div>

      {/* Content cards pulled up to overlap the banner */}
      <div className="max-w-3xl mx-auto px-4 -mt-6 pb-12 space-y-4">

        {/* CEFR Proficiency card */}
        {ep.cefrLevel && (
          <div className="bg-card rounded-2xl p-6 shadow-md border border-border">
            <p className="text-xs font-bold text-brand-700 uppercase tracking-widest text-center mb-4">
              English Proficiency Level
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-black text-brand-700 leading-none">{ep.cefrLevel}</span>
              {CEFR_LABELS[ep.cefrLevel] && (
                <span className="text-lg font-semibold text-muted-foreground">{CEFR_LABELS[ep.cefrLevel]}</span>
              )}
            </div>
            <CefrScale level={ep.cefrLevel} />
            {ep.cefrDescription && (
              <p className="text-muted-foreground text-sm mt-5 leading-relaxed text-center max-w-md mx-auto">
                {ep.cefrDescription}
              </p>
            )}
            {ep.ieltsEstimate && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="text-muted-foreground text-xs">IELTS equivalent</span>
                <span className="bg-primary/10 text-primary font-bold text-sm px-2.5 py-0.5 rounded-full">
                  {ep.ieltsEstimate}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Overall Feedback */}
        {analytics.overallFeedback && (
          <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Overall Feedback</p>
            </div>
            <p className="text-foreground text-sm leading-relaxed">{analytics.overallFeedback}</p>
          </div>
        )}

        {/* Language Skills - 2-column grid */}
        {hasSkillFeedback && (
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1 mb-3">Language Skills</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {skills.map(
                (s) => s.feedback && <SkillCard key={s.label} label={s.label} feedback={s.feedback} />
              )}
            </div>
          </div>
        )}

        {/* Question Summaries */}
        {questionSummaries.length > 0 && (
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1 mb-3">Question Summaries</p>
            <div className="space-y-3">
              {questionSummaries.map((q: any, i: number) => (
                <div key={i} className="bg-card rounded-xl p-5 shadow-sm border border-border">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm leading-snug mb-1.5">{q.question}</p>
                      {q.summary && (
                        <p className="text-muted-foreground text-sm leading-relaxed">{q.summary}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transcript - collapsible */}
        {hasTranscript && <TranscriptSection transcript={transcript} />}

        <p className="text-center text-xs text-muted-foreground pt-2">
          Your responses have been recorded and will be reviewed by the team.
        </p>
      </div>
    </div>
  );
}
