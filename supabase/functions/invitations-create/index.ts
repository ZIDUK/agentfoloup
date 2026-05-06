import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const foloupSecret = Deno.env.get("DREAMIT_FOLOUP_SECRET");
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!foloupSecret || token !== foloupSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { job_id, application_id, candidate_email, candidate_name, expires_hours } = body;

    if (!job_id || !application_id || !candidate_email) {
      return new Response(
        JSON.stringify({ error: "job_id, application_id, and candidate_email are required" }),
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

    const { data: jobRow, error: jobError } = await supabase
      .from("interview_job")
      .select("interview_id")
      .eq("job_id", job_id)
      .limit(1)
      .maybeSingle();

    if (jobError) {
      return new Response(
        JSON.stringify({ error: "Database error looking up job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!jobRow) {
      return new Response(
        JSON.stringify({ error: "no_interview_for_job" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hours = expires_hours ?? 48;
    const expires_at = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: invitation, error: upsertError } = await supabase
      .from("invitations")
      .upsert(
        {
          interview_id: jobRow.interview_id,
          application_id,
          job_id,
          candidate_email,
          candidate_name: candidate_name ?? null,
          expires_at,
          is_started: false,
          is_submitted: false,
          updated_at: now,
        },
        {
          onConflict: "application_id",
          ignoreDuplicates: false,
        },
      )
      .select()
      .single();

    if (upsertError) {
      return new Response(
        JSON.stringify({ error: "Failed to upsert invitation", detail: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ invitation }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
