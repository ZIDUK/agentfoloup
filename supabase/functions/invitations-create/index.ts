import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

async function authenticate(req: Request): Promise<Response | null> {
  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!bearer) return errorResponse("Unauthorized", 401);

  const foloupSecret = Deno.env.get("DREAMIT_FOLOUP_SECRET");
  if (foloupSecret && bearer === foloupSecret) return null; // DreamIT caller — allow

  // Otherwise verify as a Supabase JWT and require admin role
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: `Bearer ${bearer}` } } },
  );
  const { error } = await userClient.auth.getUser();
  if (error) return errorResponse("Unauthorized", 401);

  try {
    const payload = JSON.parse(atob(bearer.split(".")[1]));
    if (payload.role !== "admin") return errorResponse("Forbidden", 403);
  } catch {
    return errorResponse("Unauthorized", 401);
  }

  return null; // valid admin JWT — allow
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const authError = await authenticate(req);
  if (authError) return authError;

  let body: {
    job_id?: number;
    application_id?: string;
    candidate_email?: string;
    candidate_name?: string;
    expires_hours?: number;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid request body");
  }

  const { job_id, application_id, candidate_email, candidate_name, expires_hours } = body;

  if (!job_id) return errorResponse("job_id is required");
  if (!application_id) return errorResponse("application_id is required");
  if (!candidate_email) return errorResponse("candidate_email is required");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse("Supabase env vars not configured", 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: jobRow, error: jobError } = await supabase
    .from("interview_job")
    .select("interview_id, interview:interview_id(is_active)")
    .eq("job_id", job_id)
    .limit(1)
    .maybeSingle();

  if (jobError) return errorResponse("Database error looking up job", 500);
  if (!jobRow) return errorResponse("no_interview_for_job", 404);

  const interview = jobRow.interview as { is_active: boolean } | null;
  if (!interview || !interview.is_active) return errorResponse("Interview is not active", 400);

  const hours = typeof expires_hours === "number" && expires_hours > 0 ? expires_hours : 48;
  const expires_at = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("invitations")
    .select("*")
    .eq("application_id", application_id)
    .eq("job_id", job_id)
    .maybeSingle();

  if (existingError) return errorResponse("Database error on duplicate check", 500);
  if (existing) return jsonResponse({ invitation: existing }, 200);

  const { data: invitation, error: insertError } = await supabase
    .from("invitations")
    .insert({
      interview_id: jobRow.interview_id,
      application_id,
      job_id,
      candidate_email,
      candidate_name: candidate_name ?? null,
      expires_at,
      is_started: false,
      is_submitted: false,
      updated_at: now,
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raceExisting, error: raceError } = await supabase
        .from("invitations")
        .select("*")
        .eq("application_id", application_id)
        .maybeSingle();
      if (raceError || !raceExisting) return errorResponse("Conflict and re-fetch failed", 500);
      return jsonResponse({ invitation: raceExisting }, 200);
    }
    return errorResponse(insertError.message, 500);
  }

  return jsonResponse({ invitation }, 201);
});
