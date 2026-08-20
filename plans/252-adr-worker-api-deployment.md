# ADR-252: API Backend Must Be Deployed for the Render-Hosted Frontend

**Date:** Current session
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** ADR-004, ADR-244, GOAP-251, GOAP-252, issue #1014

## Context

The deployed site at `https://do-epub-studio.onrender.com/` is a static SPA.
Its hosting platform's catch-all fallback rewrites every unmatched path —
including `/api/*` — to `/index.html` (HTTP 301). The API backend
(`apps/worker`, a Cloudflare Worker) is deployed only by the release workflow;
its documented URLs currently fail DNS. Consequently every API-backed page
(`/catalog`, login submit, reader load) receives HTML where JSON is expected
and logs `api.parse-error` / `api.network-error`.

This was discovered during the GOAP-251 service worker verification sweep. It
is independent of the service worker fix (reproduced via curl, bypassing the
SW) and predates it.

## Decision

The production frontend deployment MUST have a reachable API backend:

1. The Cloudflare Worker (`apps/worker`) MUST be deployed to a stable URL that
   resolves from the public internet (`GET /api/health` must return a
   non-HTML, non-5xx response).
2. The web build MUST target that API via `VITE_API_BASE_URL` (same-origin
   `/api/*` is only valid when the API is served on the same origin, which the
   current Render static deployment does not do).
3. Until the API is deployed, API-backed routes are known-degraded and this is
   tracked in issue #1014; the frontend's existing error handling (log +
   user-facing error state) is the acceptable interim behavior.

## Alternatives considered

### Serve the worker on the same origin as the static site (render.yaml)

Preferred long-term if Render supports it, since it removes the
`VITE_API_BASE_URL` configuration and CORS concerns. Rejected for now because
the repo has no Render configuration and the Worker is Cloudflare-native.

### Keep same-origin `/api/*` and configure Render to proxy to the worker

Depends on Render's proxy capabilities and still requires the worker to be
deployed first. Covered by GOAP-252 execution once the worker URL is live.

### Do nothing (rely on frontend error states)

Rejected: `/catalog`, login, and the reader are core product flows, and the
console errors surface in any browser check.

## Consequences

- API-backed pages stop logging `api.parse-error` / `api.network-error` once
  GOAP-252 lands.
- A deployment runbook step (deploy worker → set `VITE_API_BASE_URL` → rebuild)
  becomes the standard for environment bring-up.
- CI can assert the API contract (JSON, not HTML) to prevent silent SPA-fallback
  regressions.
