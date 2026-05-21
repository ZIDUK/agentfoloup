"use client";

import React from "react";
import InterviewCard from "@/components/dashboard/interview/interviewCard";
import CreateInterviewCard from "@/components/dashboard/interview/createInterviewCard";
import { useInterviews } from "@/contexts/interviews.context";

function InterviewsLoader() {
  return (
    <div className="flex flex-row">
      <div className="h-60 w-56 ml-1 mr-3 mt-3 flex-none animate-pulse rounded-xl bg-muted" />
      <div className="h-60 w-56 ml-1 mr-3 mt-3 flex-none animate-pulse rounded-xl bg-muted" />
      <div className="h-60 w-56 ml-1 mr-3 mt-3 flex-none animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

function Interviews() {
  const { interviews, interviewsLoading } = useInterviews();

  return (
    <main className="p-8 pt-0 ml-12 mr-auto rounded-md">
      <div className="flex flex-col items-left">
        <h2 className="mr-2 text-2xl font-semibold tracking-tight mt-8">
          My Interviews
        </h2>
        <h3 className="text-sm tracking-tight text-muted-foreground font-medium">
          Start getting responses now!
        </h3>
        <div className="relative flex items-center mt-1 flex-wrap">
          <CreateInterviewCard />
          {interviewsLoading ? (
            <InterviewsLoader />
          ) : (
            interviews.map((item) => (
              <InterviewCard
                id={item.id}
                interviewerId={item.interviewer_id}
                key={item.id}
                name={item.name}
                url={item.url ?? ""}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";

export default Interviews;
