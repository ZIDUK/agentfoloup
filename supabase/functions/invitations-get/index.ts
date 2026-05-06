import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// base64url strings omit = padding; atob() requires it.
function b64urlDecode(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return atob(s);
}

// Verifies a Supabase JWT (anon key or user session) using HMAC-SHA256 + SUPABASE_JWT_SECRET.
// getUser() is intentionally not used here because callers are unauthenticated candidates
// who only have the anon key available via the /api/fn proxy.
async function verifySupabaseJWT(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const [header, payload, signature] = parts;

    const decoded = JSON.parse(b64urlDecode(payload));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return false;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const sigBytes = Uint8Array.from(b64urlDecode(signature), (c) => c.charCodeAt(0));

    return await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(`${header}.${payload}`),
    );
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET") ?? "";
  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";

  if (!bearer || !jwtSecret) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const valid = await verifySupabaseJWT(bearer, jwtSecret);
  if (!valid) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const applicationId = url.searchParams.get("application_id");

    if (!id && !applicationId) {
      return new Response(
        JSON.stringify({ error: "id or application_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Supabase env vars not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const query = supabase.from("invitations").select("*").limit(1).maybeSingle();
    const { data, error } = await (id ? query.eq("id", id) : query.eq("application_id", applicationId!));

    if (error) {
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const is_expired = new Date(data.expires_at) < new Date();

    return new Response(
      JSON.stringify({ invitation: data, is_expired }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
