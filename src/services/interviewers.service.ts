import { getSupabaseClient } from "@/lib/supabase-client";

const getAllInterviewers = async (clientId: string = "") => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data: clientData, error: clientError } = await supabase
      .from("interviewer")
      .select(`*`);

    if (clientError) return [];

    return clientData || [];
  } catch {
    return [];
  }
};

const createInterviewer = async (payload: any) => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  let query = supabase
    .from("interviewer")
    .select("*")
    .eq("name", payload.name);

  if (payload.agent_id) {
    query = query.eq("agent_id", payload.agent_id);
  }

  const { data: existingInterviewer, error: checkError } = await query.single();

  if (checkError && checkError.code !== "PGRST116") {
    // non-fatal check error, continue
  }

  if (existingInterviewer) {
    return existingInterviewer;
  }

  const insertPayload = {
    ...payload,
    agent_id: payload.agent_id || null,
  };

  const { error, data } = await supabase
    .from("interviewer")
    .insert(insertPayload)
    .select()
    .single();

  if (error) return null;

  return data;
};

const getInterviewer = async (interviewerId: bigint | number | string) => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const id = typeof interviewerId === 'bigint'
    ? Number(interviewerId)
    : typeof interviewerId === 'string'
    ? Number(interviewerId)
    : interviewerId;

  const { data: interviewerData, error: interviewerError } = await supabase
    .from("interviewer")
    .select("*")
    .eq("id", id)
    .single();

  if (interviewerError) return null;

  return interviewerData;
};

export const InterviewerService = {
  getAllInterviewers,
  createInterviewer,
  getInterviewer,
};
