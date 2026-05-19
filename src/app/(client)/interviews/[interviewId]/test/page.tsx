"use client";

import { useEffect, useState, Suspense } from "react";
import { useInterviews } from "@/contexts/interviews.context";
import { getSupabaseClient } from "@/lib/supabase-client";
import { Interview } from "@/types/interview";
import Call from "@/components/call";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";

type Props = {
  params: { interviewId: string };
};

interface LinkedJob {
  job_id: number;
  job_title: string;
}

function TestInterviewContent({ params }: Props) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [linkedJobs, setLinkedJobs] = useState<LinkedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [jobSelected, setJobSelected] = useState(false);
  const { getInterviewById } = useInterviews();

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.email) {
            const email = session.user.email.toLowerCase();
            const res = await fetch(`/api/user?email=${encodeURIComponent(email)}`);
            const dbUser = res.ok ? await res.json() : null;
            setUserEmail(dbUser?.email ?? email);
            setUserName(dbUser?.name ?? email.split("@")[0]);
          }
        }

        const [result, jobsRes] = await Promise.all([
          getInterviewById(params.interviewId),
          fetch(`/api/interview-jobs?interviewId=${params.interviewId}`).then((r) => r.json()).catch(() => ({ jobs: [] })),
        ]);

        if (result) setInterview(result);
        if (Array.isArray(jobsRes.jobs)) setLinkedJobs(jobsRes.jobs);
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoaderWithText />
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Interview not found.</p>
      </div>
    );
  }

  // If interview has linked jobs and user hasn't picked one yet, show picker
  if (linkedJobs.length > 0 && !jobSelected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-card rounded-xl border-2 border-border shadow-md p-8 w-[420px] flex flex-col gap-5">
          <h2 className="text-lg font-semibold text-center">Select a Job to Test</h2>
          <p className="text-sm text-muted-foreground text-center">
            This interview is linked to multiple jobs. Select one so the test response is tagged correctly, or skip to run a general test.
          </p>
          <div className="flex flex-col gap-2">
            {linkedJobs.map((job) => (
              <button
                key={job.job_id}
                className={`px-4 py-2 rounded-lg border-2 text-sm text-left transition-colors ${
                  selectedJobId === job.job_id
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedJobId(job.job_id)}
              >
                {job.job_title}
              </button>
            ))}
          </div>
          <div className="flex gap-3 mt-2">
            <button
              className="flex-1 py-2 rounded-lg border-2 border-border text-sm text-muted-foreground hover:border-border/60 transition-colors"
              onClick={() => { setSelectedJobId(null); setJobSelected(true); }}
            >
              Skip (no job)
            </button>
            <button
              disabled={selectedJobId === null}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              onClick={() => setJobSelected(true)}
            >
              Start Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <div className="hidden md:block p-4 h-full form-container">
        <Call
          interview={interview}
          isTestResponse={true}
          prefillEmail={userEmail}
          prefillName={userName}
          jobId={selectedJobId ?? undefined}
        />
      </div>
      <div className="md:hidden flex flex-col items-center justify-center my-auto">
        <div className="mt-48 px-3">
          <p className="text-center my-5 text-md font-semibold">{interview.name}</p>
          <p className="text-center text-muted-foreground my-5">
            Please use a PC to run the test interview. Apologies for any inconvenience.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TestInterviewPage({ params }: Props) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <LoaderWithText />
      </div>
    }>
      <TestInterviewContent params={params} />
    </Suspense>
  );
}
