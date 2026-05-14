import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { getAuthSession } from "@/lib/route-auth";
import { logger } from "@/lib/logger";

// Public — result page and admin dashboard both read a response by callId.
export async function GET(_req: NextRequest, { params }: { params: { callId: string } }) {
  const { callId } = params;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("responses/[callId] GET: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("response")
    .select("*")
    .filter("call_id", "eq", callId);

  if (error) {
    logger.error("responses/[callId] GET: query failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data?.[0] ?? null);
}

// Mixed — candidates save interview data (unauthenticated); admins update
// candidate_status / is_viewed (authenticated). Unauthenticated callers are
// restricted to a whitelist of candidate-safe fields.
const CANDIDATE_FIELDS = new Set([
  "is_ended", "tab_switch_count", "fullscreen_exit_count",
  "proctoring_events", "recording_url", "screen_recording_url", "details", "duration",
]);
const ADMIN_FIELDS = new Set([...CANDIDATE_FIELDS, "candidate_status", "is_viewed"]);

export async function PATCH(req: NextRequest, { params }: { params: { callId: string } }) {
  const { callId } = params;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("responses/[callId] PATCH: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const session = await getAuthSession();
  const allowedFields = session ? ADMIN_FIELDS : CANDIDATE_FIELDS;

  const raw = await req.json();
  const payload = Object.fromEntries(
    Object.entries(raw).filter(([k]) => allowedFields.has(k)),
  );

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("response")
    .update(payload)
    .eq("call_id", callId);

  if (error) {
    logger.error("responses/[callId] PATCH: update failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // When a candidate ends their call, mark the invitation as submitted.
  if (raw.is_ended === true) {
    const { data: responseRow } = await supabase
      .from("response")
      .select("application_id")
      .eq("call_id", callId)
      .maybeSingle();
    if (responseRow?.application_id) {
      await supabase
        .from("invitations")
        .update({ is_submitted: true, updated_at: new Date().toISOString() })
        .eq("application_id", responseRow.application_id);
    }
  }

  return NextResponse.json(data);
}

// Admin-only — permanently delete a response record.
export async function DELETE(_req: NextRequest, { params }: { params: { callId: string } }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { callId } = params;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("responses/[callId] DELETE: admin client unavailable");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { error } = await supabase
    .from("response")
    .delete()
    .eq("call_id", callId);

  if (error) {
    logger.error("responses/[callId] DELETE: delete failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
