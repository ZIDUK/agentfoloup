import { getSupabaseClient } from "@/lib/supabase-client";

const getClientByEmail = async (email: string) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("users")
      .select(`*`)
      .eq("email", email.toLowerCase())
      .single();

    if (error || !data) return null;
    return data;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const ClientService = {
  getClientByEmail,
};
