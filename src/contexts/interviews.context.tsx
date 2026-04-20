"use client";

import React, { useState, useContext, ReactNode, useEffect } from "react";
import { Interview } from "@/types/interview";
import { InterviewService } from "@/services/interviews.service";
import { getSupabaseClient } from "@/lib/supabase-client";

interface InterviewContextProps {
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  getInterviewById: (interviewId: string) => Interview | null | any;
  interviewsLoading: boolean;
  setInterviewsLoading: (interviewsLoading: boolean) => void;
  fetchInterviews: () => void;
}

export const InterviewContext = React.createContext<InterviewContextProps>({
  interviews: [],
  setInterviews: () => {},
  getInterviewById: () => null,
  setInterviewsLoading: () => undefined,
  interviewsLoading: false,
  fetchInterviews: () => {},
});

interface InterviewProviderProps {
  children: ReactNode;
}

export function InterviewProvider({ children }: InterviewProviderProps) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [user, setUser] = useState<any>(null);
  const supabase = getSupabaseClient();
  const [interviewsLoading, setInterviewsLoading] = useState(false);
  const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

  useEffect(() => {
    if (SKIP_AUTH) {
      const mockUser = {
        id: "dev-user-123",
        email: "dev@example.com",
        user_metadata: {},
      };
      setUser(mockUser);
      return;
    }

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase, SKIP_AUTH]);

  const fetchInterviews = async () => {
    if (!user?.id) return;

    try {
      setInterviewsLoading(true);
      const response = await InterviewService.getAllInterviews(user.id);
      setInterviews(response);
    } catch (error) {
      console.error(error);
    } finally {
      setInterviewsLoading(false);
    }
  };

  const getInterviewById = async (interviewId: string) => {
    return InterviewService.getInterviewById(interviewId);
  };

  useEffect(() => {
    if (user?.id) {
      fetchInterviews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <InterviewContext.Provider
      value={{
        interviews,
        setInterviews,
        getInterviewById,
        interviewsLoading,
        setInterviewsLoading,
        fetchInterviews,
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
}

export const useInterviews = () => {
  const value = useContext(InterviewContext);
  return value;
};
