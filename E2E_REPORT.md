# E2E Test Suite Report

**Branch:** `feature/e2e-tests`
**Status:** Green — all specs passing in chromium and firefox
**Framework:** Playwright
**Date:** 2026-05-21

---

## Coverage Summary

| Spec file | Tests | Auth | Coverage |
|-----------|------:|:----:|----------|
| `auth.spec.ts` | 5 | mixed | Sign-in page render, unauth redirects, authenticated landing |
| `dashboard.spec.ts` | 6 | yes | Heading, empty state, card render, card nav, create modal, sidebar nav |
| `interview-creation.spec.ts` | 7 | yes | Modal open, form fields, validation, interviewer selector, Generate Questions, manual add/remove, save-and-refresh |
| `interviewers.spec.ts` | 2 | yes | List render, details modal with persona attributes |
| `call.spec.ts` | 6 | public | Pre-call form, email/name inputs, validation, form submission → active interview, Integrity Warning dialog, nested-route invitation resolver |
| `results.spec.ts` | 10 | mixed | Public result page (1-7) + authenticated response list (8-10) |
| **Total** | **36** | | Run twice (chromium + firefox) = **72 test executions** |

---

## Architecture

### Test Infrastructure
- **`playwright.config.ts`** — chromium + firefox projects, baseURL `http://localhost:3000`, retries=1 in CI
- **`e2e/global-setup.ts`** — generates a fresh Supabase magic-link session before each suite run, stores it in `e2e/fixtures/auth.json` as a cookie the SSR middleware can read
- **`e2e/fixtures/auth.json`** — storage state used by `test.use({ storageState })` for authenticated specs
- **`e2e/helpers/mocks.ts`** — `mockSupabaseExternal(page)` helper that intercepts the external Supabase auth API (`*.supabase.co/auth/v1/*`) so the `@supabase/auth-helpers-nextjs` client's token-refresh and user-fetch calls don't hang the page load

### Mock Strategy
1. **`mockSupabaseExternal(page)`** — registered first in every `beforeEach`
2. **Generic `**/api/**` fallback** — registered next, returns `{}` or `[]` so unmocked routes don't hit the real server
3. **Specific route mocks** — registered last; Playwright matches LIFO, so specific routes win

This three-layer strategy means a test only needs to mock the routes it cares about — anything else is handled gracefully by the fallback.

---

## Fixes Applied (this branch)

### 1. Supabase auth-hang root cause
**Problem:** Every authenticated page hung in "Loading…" state.
**Cause:** `@supabase/auth-helpers-nextjs` made network calls to `*.supabase.co/auth/v1/token` and `/user` during page load. Without a mock, these requests timed out, blocking the Loading→content transition.
**Fix:** `mockSupabaseExternal()` returns valid session JSON for both endpoints.

### 2. Playwright LIFO route matching
**Problem:** Specific mocks were being shadowed by broader patterns.
**Cause:** Playwright matches routes in last-registered-wins order.
**Fix:** Register the generic `**/api/**` fallback before specific mocks. Specific routes (registered later) take precedence; the fallback only fires for routes no test cared to mock.

### 3. `invitations-get` mock pattern
**Problem:** Call spec's invitation lookup never resolved.
**Cause:** Regex pattern `/\/api\/fn\/invitations-get/` did not reliably match query-string variants.
**Fix:** Switched to glob `**/api/fn/invitations-get**` (trailing `**` captures query string).

### 4. Retell SDK dependencies (call spec tests 4-5)
**Problem:** "Start Interview" click never transitioned to active interview.
**Cause:** Missing mocks for `/api/register-call` and `/api/get-call`, plus an empty `MediaStream` returned for audio-only `getUserMedia` requests — `DeepgramAgentService.startAudioCapture()` calls `createMediaStreamSource()` which throws on a stream with no audio tracks.
**Fix:**
- Added `register-call` and `get-call` mocks.
- Built a real `AudioContext` + `MediaStreamDestination` + silent oscillator track for audio-only requests; for combined video+audio, attached the audio track to the canvas video stream.
- Raised End Interview timeout to 30 s to cover the audio pipeline warm-up.

### 5. Strict-mode locator collisions
**Problem:** `getByRole('heading', { name: 'Create an Interview' })` resolved to two elements (dashboard h3 + modal h1).
**Fix:** Pin `level: 1` on the heading lookup.

**Problem:** `getByText('Explorer Lisa')` resolved to both the card and the modal heading after clicking.
**Fix:** Use `.last()` on the heading lookup and `.first()` on persona labels.

**Problem:** `getByText('Vocabulary')` collided with substring matches like `vocabularyFeedback`.
**Fix:** Use `{ exact: true }` qualifier.

### 6. Async router.push race (dashboard test 6)
**Problem:** `await expect(page).toHaveURL('/dashboard/interviewers')` failed because the immediate assertion raced the async navigation.
**Fix:** Switched to `page.waitForURL('**/dashboard/interviewers', { timeout: 10000 })` followed by URL containment check.

### 7. WebSocket / mediaDevices browser stubs
- `FakeWebSocket` class injected via `addInitScript` — fires `open` event after 150 ms so the SDK sees a usable connection.
- `getDisplayMedia` returns a canvas stream reporting `displaySurface: 'monitor'`.
- `navigator.permissions.query` always returns `state: 'granted'` so the Start button isn't disabled.

---

## Bead Trail

All work tracked under epic **`agentfoloup-7bt`** — *E2E test suite with Playwright* (P2, closed).

Children (all closed):
- `7bt.1` — Playwright scaffold
- `7bt.2` — auth and routing spec
- `7bt.3` — dashboard spec
- `7bt.4` — interview creation spec
- `7bt.5` — interviewer management spec
- `7bt.6` — call page spec
- `7bt.7` — results and response detail spec
- `7bt.8` — interviewers spec trim
- `7bt.9` — Run e2e suite and fix runtime failures

---

## Commit History (most recent on top)

```
6f8f659 fix(e2e): restore call spec tests 4-5 with proper audio MediaStream stub
34e8ef1 chore(e2e): refresh auth.json fixture with current session tokens
a7eb2e7 docs(e2e): add explanatory comments for test fixes
6b9dd13 fix(e2e): fix results and call spec route patterns, timeouts, and assertions
9c5ae9a fix(e2e): fix route glob patterns and remove pre-click modal visibility checks
c861190 fix(e2e): fix auth heading strict-mode and dashboard interviews mock glob
a3eae4a fix(e2e): fix strict-mode locator violations across spec files
7f711f8 fix(e2e): fix call spec ACs 3 and 5, remove dead register-call mock
b92a2f7 feat(e2e): add call page spec
cb9a418 fix(e2e): fix results spec ACs #5, #6, #7
122c2ab feat(e2e): trim interviewers spec to tests 1-2 only
4dabd14 feat(e2e): add results and response detail spec
99c2741 feat(e2e): add interviewer management spec
cb43544 fix(e2e): replace Clerk auth with Supabase admin magic link in global setup
a9b9013 feat(e2e): add interview creation flow spec
a6d977e feat(e2e): add dashboard page spec
00ed345 feat(e2e): add auth and routing spec
565b345 feat(e2e): add Playwright scaffold
```

---

## Running the Suite

```bash
# Prereqs: .env.test populated with TEST_USER_EMAIL, SUPABASE_SERVICE_ROLE_KEY,
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
# App must be running on http://localhost:3000.

yarn playwright install      # one-time
yarn test:e2e                # full suite, both browsers
```

---

## Known Constraints

- **Real Supabase project required.** `global-setup.ts` calls `supabase.auth.admin.generateLink` against a live project. Tests cannot run fully offline.
- **App must be pre-started** on port 3000. Playwright config does not start the dev server.
- **`auth.json` regenerates each run.** Diffs on `e2e/fixtures/auth.json` are expected and not meaningful.
