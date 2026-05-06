import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { logger } from "@/lib/logger";

// Public — called on behalf of the candidate to mark invite progression.
// Only allows setting is_started and is_submitted to true (never false).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("invitations/[id] PATCH: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const raw = await req.json();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (raw.is_started === true) payload.is_started = true;
  if (raw.is_submitted === true) payload.is_submitted = true;

  if (Object.keys(payload).length === 1) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("invitations")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("invitations/[id] PATCH: update failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}
