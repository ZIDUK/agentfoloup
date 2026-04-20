"use client";

import { useEffect, useState, Suspense } from "react";
import { useInterviews } from "@/contexts/interviews.context";
import { Interview } from "@/types/interview";
import Call from "@/components/call";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";
import { getSupabaseClient } from "@/lib/supabase-client";

type Props = {
  params: { interviewId: string };
};

function TestInterviewContent({ params }: Props) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const { getInterviewById } = useInterviews();

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.email) {
            const email = session.user.email.toLowerCase();
            const { data: dbUser } = await supabase
              .from("users")
              .select("name, email")
              .eq("email", email)
              .single();
            setUserEmail(dbUser?.email ?? email);
            setUserName(dbUser?.name ?? email.split("@")[0]);
          }
        }
        const result = await getInterviewById(params.interviewId);
        if (result) setInterview(result);
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
        <p className="text-gray-500">Interview not found.</p>
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
        />
      </div>
      <div className="md:hidden flex flex-col items-center justify-center my-auto">
        <div className="mt-48 px-3">
          <p className="text-center my-5 text-md font-semibold">{interview.name}</p>
          <p className="text-center text-gray-600 my-5">
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
