import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";

export async function GET(req: NextRequest) {
  const interviewId = req.nextUrl.searchParams.get("interviewId");
  if (!interviewId) return NextResponse.json({ error: "interviewId required" }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { data, error } = await supabase
    .from("response")
    .select("*")
    .eq("interview_id", interviewId)
    .eq("is_ended", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const payload = await req.json();

  const { data, error } = await supabase
    .from("response")
    .insert(payload)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.[0]?.id ?? null });
}
