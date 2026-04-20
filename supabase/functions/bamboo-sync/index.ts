import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BAMBOO_API_KEY = Deno.env.get("BAMBOOHR_API_KEY");
const BAMBOO_SUBDOMAIN = Deno.env.get("BAMBOOHR_SUBDOMAIN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const BATCH_SIZE = 10;
const UPSERT_CHUNK = 100;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getBambooHeaders() {
  if (!BAMBOO_API_KEY) throw new Error("BAMBOOHR_API_KEY not configured");
  return {
    Accept: "application/json",
    Authorization: `Basic ${btoa(`${BAMBOO_API_KEY}:x`)}`,
  };
}

interface BambooEmployee {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  displayName: string;
  workEmail?: string;
  jobTitle?: string;
  department?: string;
  employmentStatus?: string;
  photoUrl?: string;
}

const DETAIL_FIELDS = [
  "firstName", "lastName", "displayName", "preferredName",
  "workEmail", "jobTitle", "department", "employmentStatus", "photoUrl",
].join(",");

async function fetchEmployeeDetail(id: string, fallback: Record<string, unknown>): Promise<BambooEmployee | null> {
  if (!BAMBOO_SUBDOMAIN) throw new Error("BAMBOOHR_SUBDOMAIN not configured");
  const url = `https://${BAMBOO_SUBDOMAIN}.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1/employees/${id}?fields=${DETAIL_FIELDS}`;
  try {
    const res = await fetch(url, { headers: getBambooHeaders() });
    if (!res.ok) {
      console.warn(`[bamboo-sync] detail fetch ${res.status} for employee ${id}`);
      return {
        id,
        firstName: (fallback.firstName as string) ?? "",
        lastName: (fallback.lastName as string) ?? "",
        displayName: (fallback.displayName as string) ?? (fallback.name as string) ?? "Unknown",
        workEmail: fallback.workEmail as string | undefined,
        photoUrl: fallback.photoUrl as string | undefined,
      };
    }
    const d = await res.json();
    return {
      id,
      firstName: d.firstName ?? "",
      lastName: d.lastName ?? "",
      preferredName: d.preferredName,
      displayName: d.displayName ?? `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim(),
      workEmail: d.workEmail,
      jobTitle: d.jobTitle,
      department: d.department,
      employmentStatus: d.employmentStatus,
      photoUrl: d.photoUrl ?? (fallback.photoUrl as string | undefined),
    };
  } catch (e) {
    console.error(`[bamboo-sync] detail fetch threw for employee ${id}:`, e);
    return null;
  }
}

async function fetchAllEmployees(): Promise<BambooEmployee[]> {
  if (!BAMBOO_SUBDOMAIN) throw new Error("BAMBOOHR_SUBDOMAIN not configured");
  const url = `https://${BAMBOO_SUBDOMAIN}.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1/employees/directory`;
  const res = await fetch(url, { headers: getBambooHeaders() });
  if (!res.ok) throw new Error(`BambooHR directory error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const directory = (data.employees ?? []) as Record<string, unknown>[];
  console.log(`[bamboo-sync] directory: ${directory.length} employees, fetching details...`);

  const detailed: BambooEmployee[] = [];
  for (let i = 0; i < directory.length; i += BATCH_SIZE) {
    const batch = directory.slice(i, i + BATCH_SIZE);
    const start = Date.now();
    const results = await Promise.all(batch.map((e) => fetchEmployeeDetail(String(e.id), e)));
    for (const r of results) if (r) detailed.push(r);
    const wait = Math.max(0, 1000 - (Date.now() - start));
    if (i + BATCH_SIZE < directory.length && wait > 0) await sleep(wait);
  }
  console.log(`[bamboo-sync] fetched ${detailed.length} employee details`);
  return detailed;
}

function determineRole(jobTitle?: string, department?: string): string {
  const t = jobTitle?.toLowerCase() ?? "";
  if (t.includes("director") || t.includes("ceo") || t.includes("cto") || t.includes("vp") || t.includes("chief")) return "director";
  if (t.includes("manager") || t.includes("lead") || t.includes("pm") || t.includes("scrum master")) return "pm";
  if (t.includes("senior") || t.includes("principal") || t.includes("architect")) return "pod-leader";
  return "member";
}

function mapToUserRow(emp: BambooEmployee) {
  const name = emp.displayName || emp.preferredName || `${emp.firstName} ${emp.lastName}`.trim();
  if (!emp.workEmail || !name) throw new Error(`Missing email or name for employee ${emp.id}`);
  const status = (emp.employmentStatus ?? "").toLowerCase() === "active" ? "active" : "terminated";
  return {
    bamboo_id: parseInt(emp.id),
    name,
    email: emp.workEmail,
    role: determineRole(emp.jobTitle, emp.department),
    department: emp.department ?? "Engineering",
    job_title: emp.jobTitle ?? null,
    employment_status: status,
    updated_at: new Date().toISOString(),
  };
}

async function syncPhotos(
  list: Array<{ userId: string; bambooId: number; photoUrl: string }>
): Promise<{ synced: number; errors: number }> {
  let synced = 0, errors = 0;
  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = list.slice(i, i + BATCH_SIZE);
    const start = Date.now();
    await Promise.all(batch.map(async ({ userId, bambooId, photoUrl }) => {
      try {
        const res = await fetch(photoUrl);
        if (!res.ok) { console.warn(`[bamboo-sync] photo fetch ${res.status} for bamboo_id ${bambooId}`); errors++; return; }
        const contentType = res.headers.get("content-type") ?? "image/jpeg";
        const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
        const storagePath = `${bambooId}.${ext}`;
        const bytes = await res.arrayBuffer();
        const { error: uploadErr } = await supabase.storage
          .from("employee-photos")
          .upload(storagePath, bytes, { contentType, upsert: true });
        if (uploadErr) { console.error(`[bamboo-sync] upload failed for ${bambooId}: ${uploadErr.message}`); errors++; return; }
        const { error: updateErr } = await supabase.from("users").update({ employee_photo: `employee-photos/${storagePath}` }).eq("id", userId);
        if (updateErr) { console.error(`[bamboo-sync] photo column update failed for ${userId}: ${updateErr.message}`); errors++; return; }
        synced++;
      } catch (e) {
        console.error(`[bamboo-sync] photo sync threw for bamboo_id ${bambooId}:`, e);
        errors++;
      }
    }));
    const wait = Math.max(0, 1000 - (Date.now() - start));
    if (i + BATCH_SIZE < list.length && wait > 0) await sleep(wait);
  }
  return { synced, errors };
}

async function performSync() {
  console.log("=== BAMBOO SYNC START ===");
  const employees = await fetchAllEmployees();

  const rows: ReturnType<typeof mapToUserRow>[] = [];
  const photoMap = new Map<number, string>();
  let skipped = 0;

  for (const emp of employees) {
    try {
      rows.push(mapToUserRow(emp));
      if (emp.photoUrl) photoMap.set(parseInt(emp.id), emp.photoUrl);
    } catch (e) {
      console.warn(`[bamboo-sync] skip employee ${emp.id}:`, e instanceof Error ? e.message : e);
      skipped++;
    }
  }

  let upserted = 0, upsertErrors = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase.from("users").upsert(chunk, { onConflict: "bamboo_id" });
    if (error) {
      console.error(`[bamboo-sync] upsert chunk ${i}-${i + chunk.length} failed: ${error.message}`);
      upsertErrors += chunk.length;
    } else {
      upserted += chunk.length;
    }
  }

  // Fetch inserted/updated user ids for photo sync
  const bambooIds = rows.map((r) => r.bamboo_id);
  const { data: userRows } = await supabase.from("users").select("id, bamboo_id").in("bamboo_id", bambooIds);
  const photoSyncList: Array<{ userId: string; bambooId: number; photoUrl: string }> = [];
  for (const u of userRows ?? []) {
    const photoUrl = photoMap.get(u.bamboo_id);
    if (photoUrl) photoSyncList.push({ userId: u.id, bambooId: u.bamboo_id, photoUrl });
  }

  const photoResult = await syncPhotos(photoSyncList);

  const result = { upserted, upsertErrors, skipped, photosSynced: photoResult.synced, photoErrors: photoResult.errors };
  console.log("=== BAMBOO SYNC COMPLETE ===", result);
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const result = await performSync();
    return new Response(JSON.stringify({ success: true, results: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[bamboo-sync] fatal error:", e);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
