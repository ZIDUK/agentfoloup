import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function log(level: "INFO" | "WARN" | "ERROR", msg: string, data?: unknown) {
  const entry: Record<string, unknown> = { ts: new Date().toISOString(), level, fn: "process-test-result", msg };
  if (data !== undefined) entry.data = data;
  const out = JSON.stringify(entry);
  if (level === "ERROR") console.error(out);
  else if (level === "WARN") console.warn(out);
  else console.log(out);
}

Deno.serve(async (req) => {
  try {
    // ── Parse body ────────────────────────────────────────────────────────────
    let body: { applicationId?: string; analytics?: unknown; callId?: string };
    try {
      body = await req.json();
    } catch {
      log("ERROR", "Invalid or empty request body");
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { applicationId, analytics, callId } = body;

    if (!applicationId || !analytics || !callId) {
      log("ERROR", "Missing required fields", { applicationId, callId, hasAnalytics: !!analytics });
      return new Response(JSON.stringify({ error: "applicationId, analytics, and callId are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    log("INFO", "Processing test result", { applicationId, callId });

    // ── Read secrets from Supabase env (never exposed to callers) ────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const dreamitUrl = Deno.env.get("DREAMIT_URL");
    const foloupSecret = Deno.env.get("DREAMIT_FOLOUP_SECRET");
    const dreamitServiceRoleKey = Deno.env.get("DREAMIT_SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      log("ERROR", "Supabase env vars not configured");
      return new Response(JSON.stringify({ error: "Supabase env vars not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!dreamitUrl || !foloupSecret || !dreamitServiceRoleKey) {
      log("ERROR", "DreamIT env vars not configured", {
        hasDreamitUrl: !!dreamitUrl,
        hasFoloupSecret: !!foloupSecret,
        hasDreamitServiceRoleKey: !!dreamitServiceRoleKey,
      });
      return new Response(JSON.stringify({ error: "DreamIT env vars not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Call DreamIT ──────────────────────────────────────────────────────────
    log("INFO", "Calling DreamIT process-speaking-test-results", { applicationId });
    const reqStart = Date.now();

    const dreamitRes = await fetch(
      `${dreamitUrl}/functions/v1/process-speaking-test-results`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-foloup-secret": foloupSecret,
          "Authorization": `Bearer ${dreamitServiceRoleKey}`,
        },
        body: JSON.stringify({ applicationId, analytics }),
      },
    );

    const durationMs = Date.now() - reqStart;
    log("INFO", "DreamIT responded", { status: dreamitRes.status, ok: dreamitRes.ok, durationMs });

    if (!dreamitRes.ok) {
      const responseBody = await dreamitRes.text().catch(() => "(unreadable)");
      log("ERROR", "DreamIT rejected request", {
        applicationId,
        status: dreamitRes.status,
        responseBody: responseBody.slice(0, 500),
      });
      return new Response(
        JSON.stringify({ error: "DreamIT returned non-200", status: dreamitRes.status }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Mark dreamit_notified only on HTTP 200 ────────────────────────────────
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: updateError } = await supabase
      .from("response")
      .update({ dreamit_notified: true })
      .eq("call_id", callId);

    if (updateError) {
      log("ERROR", "DB update failed after successful DreamIT delivery", {
        callId,
        error: updateError.message,
      });
      return new Response(JSON.stringify({ error: "DB update failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    log("INFO", "dreamit_notified set to true", { callId, applicationId });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR", "Fatal error", { error: message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
