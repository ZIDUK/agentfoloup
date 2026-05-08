import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirect = requestUrl.searchParams.get("redirect") || "/dashboard";

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    const origin = process.env.NEXT_PUBLIC_LIVE_URL || requestUrl.origin;
    if (error || !data.session) {
      return NextResponse.redirect(new URL("/sign-in?error=auth_failed", origin));
    }
  }

  // Redirect to the requested page or dashboard
  const origin = process.env.NEXT_PUBLIC_LIVE_URL || requestUrl.origin;
  return NextResponse.redirect(new URL(redirect, origin));
}

