import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { getAuthSession } from "@/lib/route-auth";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const interviewId = req.nextUrl.searchParams.get("interviewId");
  if (!interviewId) return NextResponse.json({ error: "interviewId required" }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("interview-jobs GET: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("interview_job")
    .select("job_id, job_title")
    .eq("interview_id", interviewId);

  if (error) {
    logger.error("interview-jobs GET: query failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ jobs: data ?? [] });
}
