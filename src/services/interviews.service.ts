import { getSupabaseClient } from "@/lib/supabase-client";

const getAllInterviews = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data: clientData } = await supabase
      .from("interview")
      .select(`*`)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    return [...(clientData || [])];
  } catch (error) {
    console.error("getAllInterviews error", error);
    return [];
  }
};

const getInterviewById = async (id: string) => {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("interview")
      .select(`*`)
      .or(`id.eq.${id},readable_slug.eq.${id}`);

    return data ? data[0] : null;
  } catch (error) {
    console.error("getInterviewById error", error);
    return [];
  }
};

const updateInterview = async (payload: any, id: string) => {
  const supabase = getSupabaseClient();
  const { error, data } = await supabase
    .from("interview")
    .update({ ...payload })
    .eq("id", id);
  if (error) {
    console.error("updateInterview error", error);
    return [];
  }

  return data;
};

const deleteInterview = async (id: string) => {
  const supabase = getSupabaseClient();

  const { error, data } = await supabase
    .from("interview")
    .update({ is_deleted: true })
    .eq("id", id);
  if (error) {
    console.error("[deleteInterview] Supabase soft-delete error:", error);
    return [];
  }

  return data;
};

const getAllRespondents = async (interviewId: string) => {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("interview")
      .select(`respondents`)
      .eq("interview_id", interviewId);

    return data || [];
  } catch (error) {
    console.error("getAllRespondents error", error);
    return [];
  }
};

const createInterview = async (payload: any) => {
  const supabase = getSupabaseClient();
  const { error, data } = await supabase
    .from("interview")
    .insert({ ...payload });
  if (error) {
    console.error("createInterview error", error);
    return [];
  }

  return data;
};

export const InterviewService = {
  getAllInterviews,
  getInterviewById,
  updateInterview,
  deleteInterview,
  getAllRespondents,
  createInterview,
};
