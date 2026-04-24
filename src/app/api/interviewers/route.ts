import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";

export async function GET() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { data, error } = await supabase.from("interviewer").select("*");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const payload = await req.json();

  const { data: existing } = await supabase
    .from("interviewer")
    .select("*")
    .eq("name", payload.name)
    .eq("agent_id", payload.agent_id ?? null)
    .maybeSingle();

  if (existing) return NextResponse.json(existing);

  const { data, error } = await supabase
    .from("interviewer")
    .insert({ ...payload, agent_id: payload.agent_id ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
