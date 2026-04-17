# DreamIT Edge Function Integration Plan

## Overview

Integrate FoloUp with the DreamIT (agentic-delivery-framework) Supabase project via three edge functions:
- `get-bamboo-jobs` — fetch available jobs for interview creation
- `update-foloup-speech-link` — register the interview URL against a job after creation
- `process-speaking-test-results` — send analytics back to DreamIT when a candidate finishes

The core pattern: DreamIT stamps a candidate's interview link with `?ref=<applicationId>`, FoloUp holds that ID through the session, then echoes it back to DreamIT alongside the analytics.

---

## Changes

### 1. Environment Variables

**File:** `.env.example`

```
# DreamIT (agentic-delivery-framework Supabase project)
DREAMIT_URL=
DREAMIT_FOLOUP_SECRET=
```

- `DREAMIT_URL` — base Supabase URL of the agentic-delivery-framework project (e.g. `https://xyz.supabase.co`)
- `DREAMIT_FOLOUP_SECRET` — shared secret validated by all three edge functions via the `x-foloup-secret` header

---

### 2. DB Migration — `interview` table

**New migration:** `supabase/migrations/20260417000001_add_job_fields_to_interview.sql`

```sql
ALTER TABLE interview ADD COLUMN job_id INTEGER;
ALTER TABLE interview ADD COLUMN job_title TEXT;
```

- `job_id` — numeric bamboo job ID from `bamboo_jobs.job_id`
- `job_title` — denormalized for display without a join

---

### 3. DB Migration — `response` table

**Same migration file:**

```sql
ALTER TABLE response ADD COLUMN application_id TEXT;
ALTER TABLE response ADD COLUMN dreamit_notified BOOLEAN DEFAULT false;
```

- `application_id` — captured from the `?ref=` query param when the candidate joins
- `dreamit_notified` — starts `false`, flipped to `true` only after `process-speaking-test-results` returns HTTP 200

---

### 4. New Internal Proxy Route — `GET /api/get-dreamit-jobs`

**New file:** `src/app/api/get-dreamit-jobs/route.ts`

Proxies requests to `GET {DREAMIT_URL}/functions/v1/get-bamboo-jobs` with the `x-foloup-secret` header. Returns `{ jobs }` to the frontend. Keeps the DreamIT secret server-side.

---

### 5. Interview Creation Form — Job Selector

**Frontend interview creation form component**

- On mount, call `GET /api/get-dreamit-jobs` and populate a job dropdown
- Selected job provides `job_id` (number) and `job_title` (string) to the create-interview payload

---

### 6. `create-interview` Route — Persist Job Fields + Notify DreamIT

**File:** `src/app/api/create-interview/route.ts`

- Accept `job_id` and `job_title` from the request body and pass them through to `InterviewService.createInterview`
- `interviews.service.ts` — `createInterview` must persist `job_id` and `job_title` on the `interview` row
- After the row is inserted, call `POST {DREAMIT_URL}/functions/v1/update-foloup-speech-link` with body `{ job_id, foloup_speech_link: url }` and header `x-foloup-secret`
- This call is **fire-and-forget** — log errors but do not fail the response if it errors

---

### 7. Candidate Join Page — Capture `?ref=` Param

**Files:** `src/app/(user)/call/[interviewId]/page.tsx` and/or `src/components/call/index.tsx`

- Read `ref` from the URL query string on page load
- Pass `application_id` into component state alongside `name` / `email`
- When `startConversation()` creates the `response` row, include `application_id` in the payload so it is stored on `response.application_id`

---

### 8. Result Processing — Send Analytics to DreamIT, Flip Flag

**File:** `src/app/api/get-call/route.ts`

After analytics are fully generated and saved, if `callDetails.application_id` is non-null **and** `callDetails.dreamit_notified === false`:

1. `POST {DREAMIT_URL}/functions/v1/process-speaking-test-results` with header `x-foloup-secret` and body `{ applicationId: callDetails.application_id, analytics }`
2. **Await** the response — do not fire-and-forget, the 200 is required to flip the flag
3. If HTTP 200 → `UPDATE response SET dreamit_notified = true WHERE call_id = ...`
4. If non-200 → log the error, leave `dreamit_notified = false` (natural retry next time `get-call` is hit)

---

## Summary Table

| # | What | Where | Notes |
|---|------|--------|-------|
| 1 | Add `DREAMIT_URL` + `DREAMIT_FOLOUP_SECRET` env vars | `.env.example` | Required for all 3 edge calls |
| 2 | Add `job_id INTEGER`, `job_title TEXT` to `interview` | New migration | Linked from bamboo_jobs |
| 3 | Add `application_id TEXT`, `dreamit_notified BOOLEAN DEFAULT false` to `response` | Same migration | Tracks candidate ref and notification state |
| 4 | New proxy route `GET /api/get-dreamit-jobs` | New route file | Proxies `get-bamboo-jobs`, keeps secret server-side |
| 5 | Interview creation form — job selector dropdown | Frontend form component | Calls proxy route on mount |
| 6 | `create-interview/route.ts` — persist job fields + call `update-foloup-speech-link` | Existing route | Fire-and-forget after row insert |
| 7 | Join page — read `?ref=` and store `application_id` | Call page + component | Stored on `response` row at session start |
| 8 | `get-call/route.ts` — call `process-speaking-test-results`, await 200, flip flag | Existing route | Awaited; flag prevents double-send |

---

## Edge Function Contracts (Reference)

### `get-bamboo-jobs`
```
GET {DREAMIT_URL}/functions/v1/get-bamboo-jobs
Headers: x-foloup-secret
Response: { jobs: { id, job_id, title, foloup_speech_link, status }[] }
```

### `update-foloup-speech-link`
```
POST {DREAMIT_URL}/functions/v1/update-foloup-speech-link
Headers: x-foloup-secret
Body: { job_id: number, foloup_speech_link: string }
Response: { success: true }
```

### `process-speaking-test-results`
```
POST {DREAMIT_URL}/functions/v1/process-speaking-test-results
Headers: x-foloup-secret
Body: { applicationId: string, analytics: FoloUpAnalytics }
Response (200): { success: true, application_id: string, status: "approved" | "rejected" }
```
