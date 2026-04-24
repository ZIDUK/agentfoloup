import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";

export async function GET(_req: NextRequest, { params }: { params: { callId: string } }) {
  const { callId } = params;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { data, error } = await supabase
    .from("response")
    .select("*")
    .filter("call_id", "eq", callId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.[0] ?? null);
}

export async function PATCH(req: NextRequest, { params }: { params: { callId: string } }) {
  const { callId } = params;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const payload = await req.json();

  const { data, error } = await supabase
    .from("response")
    .update(payload)
    .eq("call_id", callId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { callId: string } }) {
  const { callId } = params;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { error } = await supabase
    .from("response")
    .delete()
    .eq("call_id", callId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
