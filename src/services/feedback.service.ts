import { getSupabaseClient } from "@/lib/supabase-client";
import { FeedbackData } from "@/types/response";

const submitFeedback = async (feedbackData: FeedbackData) => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client not available");
  const { error, data } = await supabase
    .from("feedback")
    .insert(feedbackData)
    .select();

  if (error) {
    console.error("Error submitting feedback:", error);
    throw error;
  }

  return data;
};

export const FeedbackService = {
  submitFeedback,
};
