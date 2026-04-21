import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { applicationId } = await req.json();

  if (!applicationId) {
    return NextResponse.json({ exists: false });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ exists: false });
  }

  const { data } = await supabase
    .from("response")
    .select("id, call_id")
    .eq("application_id", applicationId)
    .limit(1);

  const record = data && data.length > 0 ? data[0] : null;
  return NextResponse.json({
    exists: !!record,
    call_id: record?.call_id ?? null,
  });
}
