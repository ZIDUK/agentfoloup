import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { logger } from "@/lib/logger";

// Public — candidates submit feedback after completing an interview.
export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("feedback POST: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const feedbackData = await req.json();

  const { data, error } = await supabase
    .from("feedback")
    .insert(feedbackData)
    .select();

  if (error) {
    logger.error("feedback POST: insert failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}
