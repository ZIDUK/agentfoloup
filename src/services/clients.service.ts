import { getSupabaseClient } from "@/lib/supabase-client";

const getClientById = async (id: string, email?: string | null) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("users")
      .select(`*`)
      .filter("id", "eq", id);

    if (!data || (data.length === 0 && email)) {
      const { error, data } = await supabase
        .from("users")
        .insert({ id: id, email: email });

      if (error) {
        console.error(error);
        return [];
      }

      return data ? data[0] : null;
    }

    return data ? data[0] : null;
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const ClientService = {
  getClientById,
};
