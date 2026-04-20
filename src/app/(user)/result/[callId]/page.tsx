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

export default function ResultPage({ params }: Props) {
  const [interviewName, setInterviewName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await ResponseService.getResponseByCallId(params.callId);
        if (response?.interview_id) {
          const interview = await InterviewService.getInterviewById(response.interview_id);
          setInterviewName(interview?.name ?? null);
        }
      } catch (err) {
        console.error(err);
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

  return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="flex flex-col items-center text-center p-10 max-w-lg">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-3">
          Interview Complete
        </h1>
        {interviewName && (
          <p className="text-gray-500 text-lg mb-2">{interviewName}</p>
        )}
        <p className="text-gray-600 mt-2">
          Thank you for completing the interview. Your responses have been
          recorded and will be reviewed shortly.
        </p>
      </div>
    </div>
  );
}
