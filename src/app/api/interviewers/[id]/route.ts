import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { logger } from "@/lib/logger";

// Public — candidate call page needs the interviewer's name, image, and voice settings.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("interviewers/[id] GET: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("interviewer")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logger.error("interviewers/[id] GET: query failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data ?? null);
}
