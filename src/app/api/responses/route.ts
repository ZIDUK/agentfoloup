import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { getAuthSession } from "@/lib/route-auth";
import { logger } from "@/lib/logger";

const DEFAULT_PAGE_SIZE = 50;

// Admin-only — list responses with optional filters and pagination.
export async function GET(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const interviewId = searchParams.get("interviewId");
  const jobId = searchParams.get("job_id");
  const email = searchParams.get("email")?.trim() || null;
  const name = searchParams.get("name")?.trim() || null;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    1000,
    Math.max(1, parseInt(searchParams.get("page_size") ?? String(DEFAULT_PAGE_SIZE), 10)),
  );

  if (!interviewId) {
    return NextResponse.json({ error: "interviewId required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("responses GET: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("response")
    .select("*", { count: "exact" })
    .eq("interview_id", interviewId!)
    .eq("is_ended", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (jobId) query = query.eq("job_id", Number(jobId));
  if (email) query = query.ilike("email", `%${email}%`);
  if (name) query = query.ilike("name", `%${name}%`);

  const { data, error, count } = await query;

  if (error) {
    logger.error("responses GET: query failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    page_size: pageSize,
  });
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
