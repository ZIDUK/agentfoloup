import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function getAuthSession() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.email?.toLowerCase().endsWith("@agenticdream.com")) {
    return null;
  }
  return session;
}
