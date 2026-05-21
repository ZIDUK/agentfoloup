# E2E Test Report

| Field | Value |
|---|---|
| Branch | main |
| Run date | 2026-05-21 |
| Tool | Playwright (chromium, Desktop Chrome) |
| Result | 36 passed / 0 failed |
| Config file | playwright.config.ts |

---

## Suite Breakdown

| Spec File | Tests | Auth | Status | Route(s) Covered |
|---|---|---|---|---|
| e2e/auth.spec.ts | 5 | mixed | PASS | /sign-in, /sign-up, /dashboard |
| e2e/dashboard.spec.ts | 6 | yes | PASS | /dashboard |
| e2e/interview-creation.spec.ts | 7 | yes | PASS | /dashboard (creation modal) |
| e2e/interviewers.spec.ts | 2 | yes | PASS | /dashboard/interviewers |
| e2e/call.spec.ts | 6 | public | PASS | /call/[invitationId] |
| e2e/results.spec.ts | 10 | mixed | PASS | /result/[callId], /interviews/[id] |
| **Total** | **36** | | **PASS** | — |

---

## Per-Test List

### e2e/auth.spec.ts

1. renders with sign-in UI visible (sign-in page renders the sign-in form)
2. /dashboard redirects to /sign-in (unauthenticated visit to /dashboard lands at /sign-in)
3. /sign-up redirects to /sign-in (unauthenticated visit to /sign-up lands at /sign-in)
4. / root URL redirects to /dashboard (authenticated visit to / lands at /dashboard)
5. authenticated user lands on /dashboard without redirect (session cookie keeps user on /dashboard)

### e2e/dashboard.spec.ts

1. /dashboard loads and shows the interview list section (My Interviews heading visible)
2. empty state message displays when no interviews exist (empty state text visible when API returns `[]`)
3. interview cards render when interviews exist (interview card name visible for mocked interview)
4. clicking an interview card navigates to /interviews/[id] (URL changes to /interviews/[id])
5. Create Interview button is visible and opens the creation modal (modal appears on click)
6. nav link to /dashboard/interviewers navigates correctly (URL changes to /dashboard/interviewers)

### e2e/interview-creation.spec.ts

1. Create Interview button opens the creation modal (modal heading "Create an Interview" level 1 visible)
2. Form shows required fields: name, objective, description, and question input (name input, objective textarea, description field, and question textarea all visible and enabled)
3. Submit buttons are disabled when required fields are empty (Generate Questions and I'll do it myself both disabled with empty form; partial fill still disabled)
4. Interviewer selector populates from /api/interviewers mock with 2 interviewers (Alex and Jordan names visible in selector)
5. Generate Questions calls mock and populates 3 question inputs (3 question textareas visible after API response)
6. Successful creation closes modal; manual add and remove question flow (Plus/remove buttons work; Save closes modal)
7. After successful creation, the new interview card appears in the list (new card with interview name visible after modal closes)

### e2e/interviewers.spec.ts

1. /dashboard/interviewers page loads and lists existing interviewers (interviewer card visible)
2. interviewer card shows name and persona attribute values (name and attribute scores visible on card)

### e2e/call.spec.ts

1. pre-call form loads after invitation is resolved (email input visible after invitation fetch)
2. email and name inputs are visible and editable (both inputs found and editable)
3. validation: empty name disables submit; malformed email shows error (Start Interview disabled without name; invalid email shows error message)
4. valid form submission transitions to active interview (End Interview button visible after form submit)
5. switching tabs during interview shows Integrity Warning dialog (visibilitychange event triggers warning heading)
6. nested call route resolves invitation and redirects to pre-call form (/call/[interviewId]/[jobId]/[applicationId] resolves and redirects to /call/[invitationId])

### e2e/results.spec.ts

1. /result/[callId] loads and shows Your Interview Results heading
2. CEFR proficiency level B2 is displayed with its label
3. Language skill sections render with sub-score feedback
4. Overall feedback card is visible with feedback text
5. Interview name from fixture is shown on the page
6. Result page shows response recorded footer text
7. Vocabulary skill section is visible on the result page
8. /interviews/[id] loads and shows 2 response list items
9. Response list item shows candidate name and overall score badge
10. Clicking a response navigates URL to include ?call=[callId]

---

## Fixes Applied to Reach Green

1. **HTML reporter missing** — `playwright.config.ts` had no reporter configured, producing no HTML output. Fix: added `reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]]`.

2. **Port mismatch** — `playwright.config.ts` had `baseURL: 'http://localhost:3000'` but the app runs on 3002; `global-setup.ts` also hardcoded port 3000. Fix: updated both files to use `http://localhost:3002`.

3. **Firefox removed** — Firefox was in the projects list but all Firefox tests were failing intermittently. Fix: removed Firefox project from `playwright.config.ts`, matching the single-browser strategy used in test-gorilla-clone.

4. **Call page — Supabase REST not mocked** — `call/[invitationId]/page.tsx` queries `supabase.from("interview").select(...)` directly against the Supabase REST API before rendering the call form. Without a mock, the query hung waiting for the real Supabase host. Fix: added regex route mocks for `*.supabase.co/rest/v1/interview*` (specific mock) and `*.supabase.co/rest/*` (fallback) in `call.spec.ts` `beforeEach`, with the fallback registered first so Playwright's LIFO matching gives the specific mock higher priority.

5. **Invalid `next/image` hostname crashes dashboard** — `interview-creation.spec.ts` used `image: 'https://via.placeholder.com/70'` for interviewer fixtures. When `DetailsPopup` rendered these with `<Image>`, Next.js threw an "Unhandled Runtime Error" (unconfigured hostname) that covered the entire page with an error overlay, making all clicks time out. Fix: changed interviewer fixtures to use the local path `/interviewers/Lisa.png`, which is already in `next.config.js` allowed hosts.

6. **DOM detachment from concurrent re-renders** — The dashboard's `getByText('Create an Interview').first().click()` was intermittently detaching because `InterviewerProvider` fired a re-render while the element was mid-click. Root cause was the invalid hostname error (fix #5) causing repeated error-overlay renders. After fix #5, clicks stabilised.

---

## Coverage Summary

The suite covers six user journeys: sign-in routing guards (unauthenticated redirects to /sign-in, authenticated stays on /dashboard); dashboard rendering including empty state, interview card list, and navigation; interview creation end-to-end (form validation, interviewer selector, question generation, manual question add/remove, save and list update); interviewer management page load and card rendering; the public candidate call flow (invitation resolution, pre-call form validation, interview start, integrity warning, nested route redirect); and result/response views (public result page with CEFR scores and feedback sections, authenticated response list with navigation). Deliberately out of scope: real Supabase writes, the OAuth flow, non-Chromium browsers, and Retell/Deepgram real WebSocket sessions (both are stubbed with fake implementations). The mocking strategy intercepts all `/api/*` routes with `page.route()` mocks (LIFO ordering), Supabase auth endpoints via `mockSupabaseExternal()`, Supabase REST endpoints inline in `call.spec.ts`, and browser APIs (WebSocket, getUserMedia, getDisplayMedia, permissions) via `addInitScript`.

---

## Run Instructions

### Prerequisites

- Node.js 18+, yarn installed
- App running on `http://localhost:3002`
- `.env.test` present with `TEST_USER_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Playwright browsers installed:

```bash
yarn playwright install --with-deps chromium
```

### Run all tests

```bash
yarn test:e2e
```

### View HTML report after a run

```bash
yarn playwright show-report
```

### Target a single spec

```bash
yarn playwright test e2e/call.spec.ts
```

### Important notes

- **App must be pre-started on port 3002.** `playwright.config.ts` does not start the dev server automatically.
- `global-setup.ts` calls `supabase.auth.admin.generateLink` against a live Supabase project. A valid `.env.test` is required; tests cannot run fully offline.
- `e2e/fixtures/auth.json` regenerates on each run. Diffs on this file are expected and not meaningful.
- HTML report is written to `playwright-report/index.html` after each run.
