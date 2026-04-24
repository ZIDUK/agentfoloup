import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";

export async function GET() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { data, error } = await supabase
    .from("interview")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
