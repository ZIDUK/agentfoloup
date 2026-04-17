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
    .select("id")
    .eq("application_id", applicationId)
    .limit(1);

  return NextResponse.json({ exists: !!(data && data.length > 0) });
}
