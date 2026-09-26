# GOAP-256: Demo-Login E2E Vertical Slice (test pyramid)

**Status:** DONE (2026-08-27)
**Date:** 2026-08-27
**Strategy:** Solo vertical slice — sync → live stack → agent-browser exploration → live e2e spec → gap check → docs
**Orchestrates:** ADR-233 (demo accounts), ADR-244 (demo login entry points)

## Context

Every existing demo-login e2e (`apps/tests/demo-login.spec.ts`) is route-mocked; no
spec drove the real Worker demo endpoints against seeded demo accounts
(`demo.reader@example.local` / `demo.admin@example.local`). This plan hardens the
demo-login flow as a vertical slice validated against a live local stack.

## Discovered defect (fixed in this change)

The Worker entry (`apps/worker/src/index.ts`) never called
`registerArgon2Wasm()` — only the Pages Function entry
(`apps/web/functions/api/[[path]].ts:34`) did. Cloudflare forbids runtime
`WebAssembly.compile()` ("Wasm code generation disallowed by embedder"), so on
`wrangler dev` / `wrangler deploy` every `verifyPassword` silently failed
(catch → `false` → "Invalid password") while argon2-free demo logins worked.
Diagnosed via a wrangler-probe: argon2 under workerd throws the embedder error
unless `setWASMModules()` receives pre-compiled modules. Fix: both export paths of
the Worker entry now funnel through one `handle()` that awaits the idempotent
`registerArgon2Wasm()` before `app.fetch` (mirrors the Pages Function entry).
Without the fix, live credential logins (reader _and_ admin password login) fail
everywhere the Worker entry serves traffic — including production `wrangler deploy`.

## Steps

1. **Sync** — `main` == `origin/main` == `b169c46` (ff-only, clean tree).
2. **Live stack** — added demo vars to `apps/worker/.dev.vars` (gitignored):
   `DEMO_LOGIN_ENABLED=1`, `DEMO_BOOK_SLUG=demo`, documented demo passwords.
   Applied local D1 migrations (`wrangler d1 migrations apply do-epub-studio
--local`, 0001-0012), then seeded via the seed script with
   `TURSO_DATABASE_URL=file:<miniflare D1 sqlite>` (seed is idempotent,
   fail-closed in production-like envs). Start order note: apply migrations and
   seed **before** `wrangler dev` to avoid any sqlite contention.
3. **Web dev** — `VITE_DEMO_LOGIN_ENABLED=1 VITE_DEMO_BOOK_SLUG=demo` on 5173.
4. **agent-browser exploration** (all verified live):
   - Reader demo button → `/read/demo` + reader toolbar ✓
   - "Fill demo credentials" → form autofill + submit → `/read/demo` ✓
     (initial failure was my own rate-limit lockout, then the wasm defect; both
     root-caused, not UI bugs)
   - Wrong password → inline "Access denied", stays on `/login` ✓
   - Admin demo button → admin session + `/admin/books` ✓
     (`/api/admin/books` GET 404 is a pre-existing gap unrelated to demo login)
   - CORS footgun (operational, not a defect): the Worker allows only
     `APP_BASE_URL` as origin — browse `http://127.0.0.1:5173`, not
     `http://localhost:5173`.
5. **Live e2e spec** — new `apps/tests/demo-login-live.spec.ts`, 4 tests,
   opt-in via `E2E_LIVE_DEMO=1`, `serial` mode (shared per-email rate limiter;
   the wrong-password test intentionally burns failures), reuses
   `suppressWorkboxErrors` + `DEMO_READER` from `fixtures.ts`.
6. **Pyramid gap check** — `routes.demo.test.ts` (19 cases: all gates incl.
   429s) + `routes.access.test.ts` (lockout semantics) already cover the
   integration layer; the exposed defect needed real workerd (unit tests mock
   argon2), so it is covered by the live spec instead. No unit additions.
7. **Docs** — this file + `.agents/AGENTS.md` (agent-browser row, demo-account
   validation bullet).

## Verification (all executed)

| Check                                                                                                                       | Result                               |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `git log -1` main == origin/main                                                                                            | `b169c46` both                       |
| `POST /api/demo/reader-login` live                                                                                          | `ok:true` + sessionToken             |
| `POST /api/demo/admin-login` live                                                                                           | `ok:true` + token/role=admin         |
| `POST /api/access/request` correct demo reader password (post-fix)                                                          | `ok:true` + sessionToken             |
| `POST /api/admin/login` correct demo admin password (post-fix)                                                              | `ok:true` + token                    |
| `POST /api/access/request` wrong password                                                                                   | 401 `ACCESS_DENIED`                  |
| agent-browser: reader demo → toolbar, credential login → `/read/demo`, wrong pw → inline error, admin demo → `/admin/books` | screenshots captured, session closed |
| `E2E_LIVE_DEMO=1 pnpm exec playwright test apps/tests/demo-login-live.spec.ts --project=chromium`                           | **4 passed**                         |
| Same without `E2E_LIVE_DEMO`                                                                                                | **4 skipped** (gate proven)          |
| `pnpm --filter @do-epub-studio/worker test:unit`                                                                            | 56 files / **442 passed**            |
| `pnpm --filter @do-epub-studio/worker exec tsc --noEmit`                                                                    | exit 0                               |
| Existing tests modified to pass                                                                                             | **none**                             |

## Files

- `apps/worker/src/index.ts` — register pre-compiled argon2 wasm in the Worker
  entry (defect fix; both Sentry and non-Sentry paths).
- `apps/tests/demo-login-live.spec.ts` — new live-stack spec (opt-in gate).
- `plans/256-goap-demo-login-e2e-vertical.md` — this file.
- `.agents/AGENTS.md` — agent-browser activation row + demo-account validation
  bullet under Test Guardrails.

## Operational notes

- Local rate-limiter DO state persists across runs; if the lockout is armed from
  manual poking: `rm -rf apps/worker/.wrangler/state/v3/do/do-epub-studio-worker-RateLimiterDO`
  then restart `wrangler dev` (the running worker holds the sqlite open).
- The live spec is local/live-only and not wired into CI (no Wrangler stack in
  the CI e2e job) by design; CI's mocked demo suite (E2E_DEMO_LOGIN) is
  untouched.
