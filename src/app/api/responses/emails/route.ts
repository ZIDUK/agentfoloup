import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { logger } from "@/lib/logger";

// Public — candidate call page checks whether a given email already has a
// response for this interview. Returns { exists: boolean } only, so no
// other candidates' email addresses are ever exposed.
export async function GET(req: NextRequest) {
  const interviewId = req.nextUrl.searchParams.get("interviewId");
  const email = req.nextUrl.searchParams.get("email");
  if (!interviewId || !email) {
    return NextResponse.json({ error: "interviewId and email required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("responses/emails GET: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("response")
    .select("id")
    .eq("interview_id", interviewId)
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) {
    logger.error("responses/emails GET: query failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ exists: !!data });
}
