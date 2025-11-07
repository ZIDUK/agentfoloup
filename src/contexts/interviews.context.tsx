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
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const supabase = getSupabaseClient();
  const [interviewsLoading, setInterviewsLoading] = useState(false);
  const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

  useEffect(() => {
    // If SKIP_AUTH is enabled, use a mock user
    if (SKIP_AUTH) {
      const mockUser = {
        id: "dev-user-123",
        email: "dev@example.com",
        user_metadata: {
          organization_id: "dev-org-123",
        },
      };
      setUser(mockUser);
      setOrganizationId(mockUser.user_metadata.organization_id);
      return;
    }

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const orgId = user.user_metadata?.organization_id || user.id;
        setOrganizationId(orgId);
      }
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const orgId = session.user.user_metadata?.organization_id || session.user.id;
        setOrganizationId(orgId);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, SKIP_AUTH]);

  const fetchInterviews = async () => {
    if (!user?.id || !organizationId) return;
    
    try {
      setInterviewsLoading(true);
      const response = await InterviewService.getAllInterviews(
        user.id,
        organizationId,
      );
      setInterviewsLoading(false);
      setInterviews(response);
    } catch (error) {
      console.error(error);
    }
    setInterviewsLoading(false);
  };

  const getInterviewById = async (interviewId: string) => {
    const response = await InterviewService.getInterviewById(interviewId);

    return response;
  };

  useEffect(() => {
    if (organizationId && user?.id) {
      fetchInterviews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, user?.id]);

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
