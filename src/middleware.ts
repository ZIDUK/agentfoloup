import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Set to true to skip authentication (for development)
const SKIP_AUTH = process.env.SKIP_AUTH === "true";

const publicRoutes = [
  "/",
  "/sign-in",
  "/sign-up",
  "/interview",
  "/call",
  "/api/register-call",
  "/api/get-call",
  "/api/generate-interview-questions",
  "/api/create-interviewer",
  "/api/analyze-communication",
];

const protectedRoutes = ["/dashboard", "/interview"];

export async function middleware(req: NextRequest) {
  // Skip authentication if SKIP_AUTH is enabled
  if (SKIP_AUTH) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // Check if route is public
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Redirect to sign-in if accessing protected route without session
  if (isProtectedRoute && !session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect to dashboard if accessing sign-in/sign-up with session
  if ((pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) && session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
