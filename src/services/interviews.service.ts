import { getSupabaseClient, getSupabaseAdminClient } from "@/lib/supabase-client";

const getAllInterviews = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data: clientData } = await supabase
      .from("interview")
      .select(`*`)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    return [...(clientData || [])];
  } catch {
    return [];
  }
};

const getInterviewById = async (id: string) => {
  try {
    // Validate format before embedding in filter string — nanoids are [A-Za-z0-9_-]
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("interview")
      .select(`*`)
      .eq("id", id);

    return data ? data[0] : null;
  } catch {
    return [];
  }
};

const updateInterview = async (payload: any, id: string) => {
  const supabase = getSupabaseClient();
  const { error, data } = await supabase
    .from("interview")
    .update({ ...payload })
    .eq("id", id);
  if (error) return [];

  return data;
};

const deleteInterview = async (id: string) => {
  const supabase = getSupabaseClient();

  const { error, data } = await supabase
    .from("interview")
    .update({ is_deleted: true })
    .eq("id", id);
  if (error) return [];

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
  } catch {
    return [];
  }
};

const createInterview = async (payload: any) => {
  const supabase = getSupabaseClient();
  const { error, data } = await supabase
    .from("interview")
    .insert({ ...payload });
  if (error) return [];

  return data;
};

const linkJobsToInterview = async (
  interviewId: string,
  jobs: { job_id: number; job_title: string }[],
) => {
  if (jobs.length === 0) return;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  await supabase.from("interview_job").insert(
    jobs.map((j) => ({ interview_id: interviewId, job_id: j.job_id, job_title: j.job_title })),
  );
};

const getLinkedJobs = async (interviewId: string) => {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("interview_job")
    .select("job_id, job_title")
    .eq("interview_id", interviewId)
    .eq("pending_removal", false);
  return data ?? [];
};

export const InterviewService = {
  getAllInterviews,
  getInterviewById,
  updateInterview,
  deleteInterview,
  getAllRespondents,
  createInterview,
  linkJobsToInterview,
  getLinkedJobs,
};
