import { NextRequest, NextResponse } from "next/server";

// Proxy for Supabase edge functions — forwards requests from the browser
// to the Supabase functions endpoint, keeping secrets server-side.
export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return proxyToEdgeFunction(req, params.path);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return proxyToEdgeFunction(req, params.path);
}

async function proxyToEdgeFunction(req: NextRequest, pathSegments: string[]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const functionName = pathSegments.join("/");
  const search = req.nextUrl.search;
  const targetUrl = `${supabaseUrl}/functions/v1/${functionName}${search}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": anonKey,
    "Authorization": `Bearer ${anonKey}`,
  };

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const upstream = await fetch(targetUrl, init);
  const body = await upstream.text();

  return new NextResponse(body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
