import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const dreamitUrl = Deno.env.get("DREAMIT_URL");
    const foloupSecret = Deno.env.get("DREAMIT_FOLOUP_SECRET");
    const dreamitServiceRoleKey = Deno.env.get("DREAMIT_SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
    }

    if (!dreamitUrl || !foloupSecret || !dreamitServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "DreamIT env vars not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch all analysed responses not yet sent to DreamIT
    const { data: responses, error } = await supabase
      .from("response")
      .select("call_id, application_id, analytics")
      .eq("processed_by_foloup", true)
      .eq("dreamit_notified", false)
      .not("application_id", "is", null);

    if (error) {
      throw new Error(`DB fetch error: ${error.message}`);
    }

    if (!responses || responses.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending responses", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    let succeeded = 0;
    let failed = 0;

    for (const response of responses) {
      try {
        const res = await fetch(
          `${dreamitUrl}/functions/v1/process-speaking-test-results`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-foloup-secret": foloupSecret,
              "Authorization": `Bearer ${dreamitServiceRoleKey}`,
            },
            body: JSON.stringify({
              applicationId: response.application_id,
              analytics: response.analytics,
            }),
          },
        );

        if (res.ok) {
          await supabase
            .from("response")
            .update({ dreamit_notified: true })
            .eq("call_id", response.call_id);
          succeeded++;
        } else {
          console.error(`DreamIT rejected application ${response.application_id}: ${res.status}`);
          failed++;
        }
      } catch (err) {
        console.error(`Error sending application ${response.application_id}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed: responses.length, succeeded, failed }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("retry-dreamit fatal error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
