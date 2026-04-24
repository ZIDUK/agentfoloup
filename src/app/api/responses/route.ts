import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { getAuthSession } from "@/lib/route-auth";
import { logger } from "@/lib/logger";

// Admin-only — list all responses for an interview.
export async function GET(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const interviewId = req.nextUrl.searchParams.get("interviewId");
  if (!interviewId) return NextResponse.json({ error: "interviewId required" }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("responses GET: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("response")
    .select("*")
    .eq("interview_id", interviewId)
    .eq("is_ended", true)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("responses GET: query failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

// Public — candidates create a response record when starting an interview.
export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("responses POST: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const payload = await req.json();

  const { data, error } = await supabase
    .from("response")
    .insert(payload)
    .select("id");

  if (error) {
    logger.error("responses POST: insert failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ id: data?.[0]?.id ?? null });
}
