# ADR-252: Serve the API on the same origin as the deployed frontend

**Date:** Current session
**Status:** Accepted (supersedes the standalone-Worker approach below)
**Deciders:** Project maintainer
**Related:** ADR-004, ADR-244, GOAP-251, GOAP-252, issue #1014

## Context

The deployed site is a static SPA whose hosting platform's catch-all fallback
rewrites every unmatched path — including `/api/*` — to the SPA shell (HTML).
The API backend (`apps/worker`, a Cloudflare Worker) was never deployed to a
reachable URL (its documented `*.workers.dev` URLs fail DNS). Consequently
every API-backed page (`/catalog`, login submit, reader load) receives HTML
where JSON is expected and logs `api.parse-error` / "Invalid server response".

The frontend build runs on **Cloudflare Pages directly** (Pages Git
integration; root `wrangler.toml` sets `pages_build_output_dir`). This means
the API can ride the same Pages deployment, eliminating the separate Worker
deploy and its credential/CORS/VITE_API_BASE_URL burden.

## Decision

The production API MUST be served on the **same origin** as the frontend via
**Cloudflare Pages Functions**:

1. `apps/web/functions/api/[[path]].ts` re-serves the existing Worker's Hono
   app (`apps/worker/src/app`) for all `/api/*` requests. The Pages build
   bundles it automatically alongside the static SPA. The `functions/`
   directory must live under the Pages project root (`apps/web`) — the Git
   integration does not detect it at the repo root.
2. Cloudflare resources (D1 `DB`, R2 `BOOKS_BUCKET`, KV `CACHE_KV`) and
   vars/secrets are bound to the Pages project in the Cloudflare dashboard
   (the Worker's `wrangler.jsonc` remains the local-dev config).
3. No `VITE_API_BASE_URL` and no CORS are needed — the web app's production
   default (`window.location.origin`) already targets same-origin `/api/*`.
4. The `RATE_LIMITER` Durable Object cannot be created inside a Pages project;
   rate limiting fails open (documented in `rate-limit-client.ts`). Email
   Sending is not a Pages Function binding; recovery email falls back to
   logging. Neither affects login.
5. `GET /api/health` is the deploy verification contract (liveness, no DB
   dependency).

## Alternatives considered

### Deploy the Worker standalone (`wrangler deploy`) + `VITE_API_BASE_URL`

This was the initial approach (PR #1018 restored the deploy step). Rejected as
the primary path because it requires Cloudflare credentials in CI, a separate
API origin, CORS, and a `VITE_API_BASE_URL` build-time setting — all avoided by
the same-origin Pages Functions approach. The Worker code is unchanged; only
its serving surface differs.

### Serve the worker on the same origin as the static site (render.yaml)

Render cannot run the Cloudflare-native Worker (D1/R2/KV/DO bindings), and the
repo has no Render configuration. Rejected.

### Do nothing (rely on frontend error states)

Rejected: `/catalog`, login, and the reader are core product flows, and the
console errors surface in any browser check.

## Consequences

- API-backed pages stop logging `api.parse-error` / "Invalid server response"
  once the Pages deployment includes the Functions and has its bindings.
- No credentials are required for deployment — the build runs on Cloudflare
  directly; only one-time dashboard binding setup is operator work.
- CI can assert the API contract (JSON, not HTML) at
  `https://do-epub-studio.pages.dev/api/health` to prevent silent SPA-fallback
  regressions.
- Operators must configure D1/R2/KV bindings + vars on the Pages project
  (see `docs/runbooks/infrastructure-setup.md`).
