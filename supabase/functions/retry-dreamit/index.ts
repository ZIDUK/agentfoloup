import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function log(level: "INFO" | "WARN" | "ERROR", msg: string, data?: unknown) {
  const entry: Record<string, unknown> = { ts: new Date().toISOString(), level, fn: "retry-dreamit", msg };
  if (data !== undefined) entry.data = data;
  const out = JSON.stringify(entry);
  if (level === "ERROR") console.error(out);
  else if (level === "WARN") console.warn(out);
  else console.log(out);
}

Deno.serve(async (_req) => {
  const fnStart = Date.now();
  log("INFO", "Function invoked");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const dreamitUrl = Deno.env.get("DREAMIT_URL");
    const foloupSecret = Deno.env.get("DREAMIT_FOLOUP_SECRET");
    const dreamitServiceRoleKey = Deno.env.get("DREAMIT_SUPABASE_SERVICE_ROLE_KEY");

    log("INFO", "Env vars loaded", {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      hasDreamitUrl: !!dreamitUrl,
      hasFoloupSecret: !!foloupSecret,
      hasDreamitServiceRoleKey: !!dreamitServiceRoleKey,
    });

    if (!supabaseUrl || !serviceRoleKey) {
      const msg = "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured";
      log("ERROR", msg);
      throw new Error(msg);
    }

    if (!dreamitUrl || !foloupSecret || !dreamitServiceRoleKey) {
      log("ERROR", "DreamIT env vars not configured", {
        hasDreamitUrl: !!dreamitUrl,
        hasFoloupSecret: !!foloupSecret,
        hasDreamitServiceRoleKey: !!dreamitServiceRoleKey,
      });
      return new Response(
        JSON.stringify({ error: "DreamIT env vars not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    log("INFO", "Fetching pending responses from DB");
    const dbFetchStart = Date.now();
    const { data: responses, error } = await supabase
      .from("response")
      .select("call_id, application_id, analytics")
      .eq("processed_by_foloup", true)
      .eq("dreamit_notified", false)
      .not("application_id", "is", null)
      .not("analytics", "is", null);

    log("INFO", "DB fetch complete", {
      durationMs: Date.now() - dbFetchStart,
      rowCount: responses?.length ?? 0,
      error: error?.message ?? null,
    });

    if (error) {
      throw new Error(`DB fetch error: ${error.message}`);
    }

    if (!responses || responses.length === 0) {
      log("INFO", "No pending responses found, exiting early");
      return new Response(
        JSON.stringify({ message: "No pending responses", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    log("INFO", `Processing ${responses.length} response(s)`);

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const callId = response.call_id;
      const appId = response.application_id;
      const iterLabel = `[${i + 1}/${responses.length}] call_id=${callId}`;

      log("INFO", `${iterLabel} Starting`, { application_id: appId });

      try {
        if (!response.analytics) {
          log("ERROR", `${iterLabel} analytics is null — skipping, record should not reach this queue`, { application_id: appId });
          failed++;
          continue;
        }

        log("INFO", `${iterLabel} Sending to DreamIT`, {
          application_id: appId,
          dreamitUrl,
          hasAnalytics: true,
        });

        const reqStart = Date.now();
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
              applicationId: appId,
              analytics: response.analytics,
            }),
          },
        );

        const status = res.status;
        log("INFO", `${iterLabel} DreamIT responded`, { status, ok: res.ok, durationMs: Date.now() - reqStart });

        if (res.ok) {
          const saveStart = Date.now();
          const { error: updateError } = await supabase
            .from("response")
            .update({ dreamit_notified: true })
            .eq("call_id", callId);

          if (updateError) {
            log("ERROR", `${iterLabel} DB update failed after successful DreamIT delivery`, {
              error: updateError.message,
              code: updateError.code,
            });
            failed++;
          } else {
            log("INFO", `${iterLabel} dreamit_notified flag set, DB update succeeded`, { durationMs: Date.now() - saveStart });
            succeeded++;
          }
        } else {
          const body = await res.text().catch(() => "(unreadable)");
          log("ERROR", `${iterLabel} DreamIT rejected request`, {
            application_id: appId,
            status,
            responseBody: body.slice(0, 500),
          });
          failed++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        log("ERROR", `${iterLabel} Failed`, { application_id: appId, error: msg, stack });
        failed++;
      }
    }

    const summary = { processed: responses.length, succeeded, failed, totalDurationMs: Date.now() - fnStart };
    log("INFO", "Function complete", summary);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log("ERROR", "Fatal error", { error: message, stack, totalDurationMs: Date.now() - fnStart });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
