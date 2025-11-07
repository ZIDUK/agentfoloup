import { getSupabaseClient } from "@/lib/supabase-client";

const getAllInterviewers = async (clientId: string = "") => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data: clientData, error: clientError } = await supabase
      .from("interviewer")
      .select(`*`);

    if (clientError) {
      console.error(
        `Error fetching interviewers for clientId ${clientId}:`,
        clientError,
      );

      return [];
    }

    return clientData || [];
  } catch (error) {
    console.log(error);

    return [];
  }
};

const createInterviewer = async (payload: any) => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  // Check for existing interviewer with the same name
  // Only check agent_id if it's provided
  let query = supabase
    .from("interviewer")
    .select("*")
    .eq("name", payload.name);

  if (payload.agent_id) {
    query = query.eq("agent_id", payload.agent_id);
  }

  const { data: existingInterviewer, error: checkError } = await query.single();

  if (checkError && checkError.code !== "PGRST116") {
    console.error("Error checking existing interviewer:", checkError);
    // Continue anyway, might be a different error
  }

  if (existingInterviewer) {
    console.log("An interviewer with this name already exists, skipping creation");
    return existingInterviewer;
  }

  // Ensure agent_id is set (can be null for development)
  const insertPayload = {
    ...payload,
    agent_id: payload.agent_id || null,
  };

  const { error, data } = await supabase
    .from("interviewer")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Error creating interviewer:", error);
    return null;
  }

  return data;
};

const getInterviewer = async (interviewerId: bigint | number | string) => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  // Convert to number for Supabase query (Supabase handles number IDs better)
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

  if (interviewerError) {
    console.error("Error fetching interviewer:", interviewerError);
    return null;
  }

  return interviewerData;
};

export const InterviewerService = {
  getAllInterviewers,
  createInterviewer,
  getInterviewer,
};
