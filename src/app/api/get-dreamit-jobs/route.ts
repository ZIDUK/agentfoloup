import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/route-auth";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dreamitUrl = process.env.DREAMIT_URL;
  const secret = process.env.DREAMIT_FOLOUP_SECRET;
  const serviceRoleKey = process.env.DREAMIT_SUPABASE_SERVICE_ROLE_KEY;

  if (!dreamitUrl || !secret || !serviceRoleKey) {
    return NextResponse.json({ jobs: [] }, { status: 200 });
  }

  try {
    const res = await fetch(`${dreamitUrl}/functions/v1/get-bamboo-jobs`, {
      headers: {
        "x-foloup-secret": secret,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch jobs from DreamIT" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "DreamIT request failed" }, { status: 500 });
  }
}
