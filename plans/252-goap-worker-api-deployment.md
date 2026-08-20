# GOAP-252: Deploy Worker API for the Render-Hosted Frontend

**Date:** Current session
**Status:** OPEN (follow-up from GOAP-251 / PR #1013)
**Related:** ADR-252, issue #1014

## Problem

While sweeping the deployed site (`https://do-epub-studio.onrender.com/`) for
console errors, the `/catalog` route logs two errors on every visit:

- `api.parse-error` — `/api/catalog?limit=24&offset=0` returns `200` with an
  HTML body (`<!DOCTYPE html>`) instead of JSON.
- `api.network-error` — "Invalid server response".

Root cause is **server-side and pre-existing** (reproducible with curl, which
bypasses the service worker entirely):

1. The Render deployment is a static SPA whose fallback catch-all 301s every
   unknown path — including `/api/*` — to `/index.html`:
   `GET /api/catalog` → `301 → /index.html?limit=24&offset=0`.
2. The API backend is a Cloudflare Worker (`apps/worker`) that is deployed only
   by the **release workflow** (`release.yml`, `wrangler deploy`). Its
   documented URLs (`https://api.do-epub-studio.workers.dev` and
   `https://do-epub-studio.d-oit.workers.dev`) currently fail DNS.
3. The web app only calls same-origin `/api/*` in production unless
   `VITE_API_BASE_URL` is baked in — no Render deployment sets it.

Unauthenticated routes (`/login`, `/help`, `/admin/login`, `/library`,
`/settings`) are console-clean; only API-backed pages (`/catalog`, login
submit, reader load) are affected.

## Execution (proposed)

1. Deploy the worker to a stable URL: `pnpm exec wrangler deploy` with Turso/R2
   env (see `docs/runbooks/infrastructure-setup.md`); verify
   `GET /api/health` returns 200/204.
2. Configure the Render service env `VITE_API_BASE_URL` to the deployed worker
   origin (or add `render.yaml` to the repo so the API is served on the same
   origin).
3. Rebuild the web app with the env var; verify `/catalog` loads JSON and the
   reader demo login works.
4. Add a CI smoke check that asserts `GET /api/catalog` does not return HTML
   (catches "SPA fallback swallowed the API" regressions).

## Acceptance criteria

- `GET /api/catalog` returns JSON from the deployed origin (200 + content-type
  `application/json`).
- `/catalog` page shows no `api.parse-error` / `api.network-error` console
  errors.
- Login (reader + admin) works against the live API.
- The tracking issue #1014 is closed with evidence (curl output + console
  screenshot).
