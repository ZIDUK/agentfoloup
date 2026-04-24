import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function log(level: "INFO" | "WARN" | "ERROR", msg: string, data?: unknown) {
  const entry: Record<string, unknown> = { ts: new Date().toISOString(), level, fn: "retry-dreamit-jobs", msg };
  if (data !== undefined) entry.data = data;
  const out = JSON.stringify(entry);
  if (level === "ERROR") console.error(out);
  else if (level === "WARN") console.warn(out);
  else console.log(out);
}

async function callDreamit(
  dreamitUrl: string,
  secret: string,
  serviceRoleKey: string,
  jobId: number,
  link: string | null,
): Promise<boolean> {
  try {
    const r = await fetch(`${dreamitUrl}/functions/v1/update-foloup-speech-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-foloup-secret": secret,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ job_id: jobId, foloup_speech_link: link }),
    });
    return r.ok;
  } catch {
    return false;
  }
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

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
    }

    if (!dreamitUrl || !foloupSecret || !dreamitServiceRoleKey) {
      log("ERROR", "DreamIT env vars not configured");
      return new Response(
        JSON.stringify({ error: "DreamIT env vars not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let addSucceeded = 0, addFailed = 0, removeSucceeded = 0, removeFailed = 0;

    const MAX_RETRIES = 5;

    // 1. Retry unsynced additions: dreamit_synced = false, pending_removal = false, under retry limit
    const { data: unsynced, error: unsyncedError } = await supabase
      .from("interview_job")
      .select("job_id, interview_id, dreamit_retry_count, interview!inner(url, is_active)")
      .eq("dreamit_synced", false)
      .eq("pending_removal", false)
      .lt("dreamit_retry_count", MAX_RETRIES);

    if (unsyncedError) {
      log("ERROR", "Failed to fetch unsynced jobs", { error: unsyncedError.message });
    } else if (unsynced && unsynced.length > 0) {
      log("INFO", `Processing ${unsynced.length} unsynced addition(s)`);

      for (const row of unsynced) {
        const interview = row.interview as { url: string; is_active: boolean };
        const link = interview.is_active ? interview.url : null;
        const ok = await callDreamit(dreamitUrl, foloupSecret, dreamitServiceRoleKey, Number(row.job_id), link);

        if (ok) {
          const { error: updateError } = await supabase
            .from("interview_job")
            .update({ dreamit_synced: true })
            .eq("interview_id", row.interview_id)
            .eq("job_id", row.job_id);

          if (updateError) {
            log("ERROR", "Failed to mark job as synced after DreamIT success", { job_id: row.job_id, error: updateError.message });
            addFailed++;
          } else {
            addSucceeded++;
          }
        } else {
          await supabase
            .from("interview_job")
            .update({ dreamit_retry_count: row.dreamit_retry_count + 1 })
            .eq("interview_id", row.interview_id)
            .eq("job_id", row.job_id);

          const newCount = row.dreamit_retry_count + 1;
          if (newCount >= MAX_RETRIES) {
            log("ERROR", "Max retries reached for unsynced job — manual intervention required", { job_id: row.job_id, interview_id: row.interview_id });
          } else {
            log("WARN", "DreamIT call failed for unsynced job, will retry next run", { job_id: row.job_id, retry_count: newCount });
          }
          addFailed++;
        }
      }
    }

    // 2. Retry pending removals: pending_removal = true, under retry limit
    const { data: pending, error: pendingError } = await supabase
      .from("interview_job")
      .select("job_id, interview_id, dreamit_retry_count")
      .eq("pending_removal", true)
      .lt("dreamit_retry_count", MAX_RETRIES);

    if (pendingError) {
      log("ERROR", "Failed to fetch pending removals", { error: pendingError.message });
    } else if (pending && pending.length > 0) {
      log("INFO", `Processing ${pending.length} pending removal(s)`);

      for (const row of pending) {
        const ok = await callDreamit(dreamitUrl, foloupSecret, dreamitServiceRoleKey, Number(row.job_id), null);

        if (ok) {
          const { error: deleteError } = await supabase
            .from("interview_job")
            .delete()
            .eq("interview_id", row.interview_id)
            .eq("job_id", row.job_id);

          if (deleteError) {
            log("ERROR", "Failed to delete job after DreamIT nullify success", { job_id: row.job_id, error: deleteError.message });
            removeFailed++;
          } else {
            removeSucceeded++;
          }
        } else {
          await supabase
            .from("interview_job")
            .update({ dreamit_retry_count: row.dreamit_retry_count + 1 })
            .eq("interview_id", row.interview_id)
            .eq("job_id", row.job_id);

          const newCount = row.dreamit_retry_count + 1;
          if (newCount >= MAX_RETRIES) {
            log("ERROR", "Max retries reached for pending removal — manual intervention required", { job_id: row.job_id, interview_id: row.interview_id });
          } else {
            log("WARN", "DreamIT nullify failed for pending removal, will retry next run", { job_id: row.job_id, retry_count: newCount });
          }
          removeFailed++;
        }
      }
    }

    const summary = { addSucceeded, addFailed, removeSucceeded, removeFailed, totalDurationMs: Date.now() - fnStart };
    log("INFO", "Function complete", summary);
    return new Response(JSON.stringify(summary), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log("ERROR", "Fatal error", { error: message, stack, totalDurationMs: Date.now() - fnStart });
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
