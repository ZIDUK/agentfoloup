# E2E Test Suite Report

**Branch:** `main`
**Status:** ✅ 36 passed, 0 failed (36 total)
**Framework:** Playwright
**Date:** 2026-05-21
**Base URL:** `http://localhost:3002`

---

## Coverage Summary

| Spec file | Tests | Auth | Chromium |
|-----------|------:|:----:|:--------:|
| `auth.spec.ts` | 5 | mixed | ✅ 5/5 |
| `dashboard.spec.ts` | 6 | yes | ✅ 6/6 |
| `interview-creation.spec.ts` | 7 | yes | ✅ 7/7 |
| `interviewers.spec.ts` | 2 | yes | ✅ 2/2 |
| `call.spec.ts` | 6 | public | ✅ 6/6 |
| `results.spec.ts` | 10 | mixed | ✅ 10/10 |
| **Total** | **36** | | **36/36** |

---

## Architecture

### Test Infrastructure
- **`playwright.config.ts`** — chromium only, baseURL `http://localhost:3002`, retries=1 in CI, HTML reporter → `playwright-report/`
- **`e2e/global-setup.ts`** — generates a fresh Supabase magic-link session before each suite run, stores it in `e2e/fixtures/auth.json` as a cookie the SSR middleware can read
- **`e2e/fixtures/auth.json`** — storage state used by `test.use({ storageState })` for authenticated specs
- **`e2e/helpers/mocks.ts`** — `mockSupabaseExternal(page)` helper that intercepts the external Supabase auth API (`*.supabase.co/auth/v1/*`) so the `@supabase/auth-helpers-nextjs` client's token-refresh and user-fetch calls don't hang the page load

### Mock Strategy
1. **`mockSupabaseExternal(page)`** — registered first in every `beforeEach`
2. **Generic `**/api/**` fallback** — registered next, returns `{}` or `[]` so unmocked routes don't hit the real server
3. **Specific route mocks** — registered last; Playwright matches LIFO, so specific routes win
4. **Supabase REST mocks** — `call.spec.ts` adds inline regex mocks for `*.supabase.co/rest/v1/*` because the call page queries Supabase directly

---

## Running the Suite

```bash
# Prereqs: .env.test populated with TEST_USER_EMAIL, SUPABASE_SERVICE_ROLE_KEY,
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
# App must be running on http://localhost:3002.

yarn playwright install      # one-time
yarn test:e2e                # full suite (chromium)
```

HTML report is written to `playwright-report/index.html` after each run.

See `docs/e2e-report.md` for the detailed per-test list and fixes applied.

---

## Known Constraints

- **Real Supabase project required.** `global-setup.ts` calls `supabase.auth.admin.generateLink` against a live project. Tests cannot run fully offline.
- **App must be pre-started** on port 3002. Playwright config does not start the dev server.
- **`auth.json` regenerates each run.** Diffs on `e2e/fixtures/auth.json` are expected and not meaningful.

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
