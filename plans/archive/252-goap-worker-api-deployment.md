# GOAP-252: Serve the API on the same origin as the deployed frontend

**Date:** 2026-08-20
**Status:** Code complete — API wired into the Cloudflare Pages build via Pages Functions; remaining work is operator dashboard setup (D1/KV/R2 bindings + vars) and data seeding.
**Related:** ADR-252, issue #1014

## Decision (updated)

The frontend build runs on **Cloudflare Pages directly** (Pages Git
integration, root `wrangler.toml`). The API is served on the **same origin**
by a Pages Function (`functions/api/[[path]].ts`) that re-serves the existing
Worker's Hono app. This is ADR-252's "preferred long-term" option: no
separate Worker deployment, no `VITE_API_BASE_URL`, no CORS.

## Completed work

### PR #1018
- Added `GET /api/health` — the ADR-252 acceptance contract referenced a
  health endpoint that did not exist in the worker. New route + unit test.
- Post-deploy health check is fail-closed — asserts `GET /api/health` returns
  `200` + `{"ok":true}` and exits 1 otherwise (ADR-187).

### PR #1019
- Wired D1 `migrations_dir` → `packages/schema/migrations` (the 12 migrations
  were unreachable, so a fresh DB would deploy empty).
- Corrected the infrastructure runbook (D1 is the runtime DB, not Turso).

### PR #1021 (this change)
- Added `apps/web/functions/api/[[path]].ts` — a Cloudflare Pages Function
  catch-all that serves the Worker's Hono app on `/api/*` same-origin.
  **Location matters:** the Pages Git integration only detects `functions/`
  under the project root (`apps/web`), NOT at the repo root — verified by
  deploying at both locations. Bundled automatically by the Pages build
  (verified: `wrangler pages functions build` compiles a ~2MB bundle;
  `wrangler pages dev` serves `/api/health` as JSON; the live preview returns
  `{"ok":true}` for `/api/health`).
- Removed the standalone `wrangler deploy` step from `release.yml` (the API
  rides the Pages deployment — no credentials needed) and pointed the
  post-deploy health check at `https://do-epub-studio.pages.dev/api/health`.
- Updated `docs/runbooks/infrastructure-setup.md` for the Pages Functions
  model (dashboard bindings, no `VITE_API_BASE_URL`).

## Remaining (operator, no code changes)

1. Create D1 (`wrangler d1 create do-epub-studio`), R2 bucket, KV namespace.
2. Apply migrations (`wrangler d1 migrations apply do-epub-studio --remote`).
3. Bind `DB` / `BOOKS_BUCKET` / `CACHE_KV` on the Pages project (dashboard).
4. Set Pages env vars/secrets: `SESSION_SIGNING_SECRET`, `INVITE_TOKEN_SECRET`,
   `APP_BASE_URL=https://do-epub-studio.pages.dev`, `ENVIRONMENT=production`,
   `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN`.
5. Seed accounts/books (schema migrations + admin bootstrap).
6. Push to production branch → Pages builds frontend + `functions/` → the API
   is live on the same origin. Verify `GET /api/health` and login.

## Problem (original)

While sweeping the deployed site for console errors, `/catalog` and login
submit logged `api.parse-error` / "Invalid server response" because `/api/*`
hit a static SPA fallback (HTML) instead of a JSON API. The API backend
(`apps/worker`) had never been deployed to a reachable URL.

## Acceptance criteria

- `GET /api/health` returns `200` + `{"ok":true}` from the Pages origin.
- `GET /api/catalog` returns JSON, not HTML.
- Login (reader + admin) works against the live API.
- Issue #1014 closed with evidence (curl output + browser verification).
