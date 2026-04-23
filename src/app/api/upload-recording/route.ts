import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as Blob | null;
  const callId = formData.get("callId") as string | null;
  const rawMime = (formData.get("mimeType") as string | null) || "";
  const allowedMimeTypes = ["video/webm", "video/mp4", "video/ogg", "audio/webm", "audio/mp4"];
  const mimeType = allowedMimeTypes.includes(rawMime) ? rawMime : "video/webm";

  if (!file || !callId) {
    return NextResponse.json({ error: "Missing file or callId" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const ext = mimeType.includes("mp4") ? "mp4" : "webm";
  const fileName = `${callId}.${ext}`;

  const { error } = await supabase.storage
    .from("interview-recordings")
    .upload(fileName, file, { contentType: mimeType, upsert: true });

  if (error) {
    return NextResponse.json({ error: "Failed to upload recording" }, { status: 500 });
  }

  const { data } = supabase.storage
    .from("interview-recordings")
    .getPublicUrl(fileName);

  return NextResponse.json({ url: data.publicUrl });
}
