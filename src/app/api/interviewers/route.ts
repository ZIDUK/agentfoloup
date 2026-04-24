import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { getAuthSession } from "@/lib/route-auth";
import { logger } from "@/lib/logger";

// Admin-only — list all interviewers for the dashboard.
export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("interviewers GET: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase.from("interviewer").select("*");

  if (error) {
    logger.error("interviewers GET: query failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

// Admin-only — create a custom interviewer.
const ALLOWED_INTERVIEWER_FIELDS = new Set([
  "name", "empathy", "rapport", "exploration", "speed", "image",
  "agent_id", "audio", "user_id",
]);

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("interviewers POST: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const raw = await req.json();
  const payload = Object.fromEntries(
    Object.entries(raw).filter(([k]) => ALLOWED_INTERVIEWER_FIELDS.has(k)),
  );

  const { data: existing } = await supabase
    .from("interviewer")
    .select("*")
    .eq("name", payload.name)
    .eq("agent_id", (payload.agent_id as string | null) ?? null)
    .maybeSingle();

  if (existing) return NextResponse.json(existing);

  const { data, error } = await supabase
    .from("interviewer")
    .insert({ ...payload, agent_id: (payload.agent_id as string | null) ?? null })
    .select()
    .single();

  if (error) {
    logger.error("interviewers POST: insert failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}
