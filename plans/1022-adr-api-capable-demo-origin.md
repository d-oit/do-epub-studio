# ADR-1022: An advertised demo origin must serve its API routes

**Status:** Accepted (this PR)
**Deciders:** Project maintainers and deployment owner
**Related:** GOAP-314, issue #1014, issue #1261, ADR-252, ADR-1014

## Context

The requested public origin, `https://do-epub-studio.onrender.com`, renders the sign-in SPA, but its `/api/health` path returns a 301 redirect to `/index.html` with an HTML content type. A real-browser click on **Try the demo** stays on the sign-in page. The origin's `/_routes.json` response lists `/api/*`, but that response does not establish that the host executes a Pages Function.

The current repository runbook uses Cloudflare Pages Functions for the API. ADR-252 records that Render static hosting cannot execute the Cloudflare-native Worker. The user-required Render origin and the current Pages-only serving architecture therefore do not currently match. The existing demo policy also keeps demo data isolated from production; this decision must not weaken that boundary.

## Decision

1. The supplied `do-epub-studio.onrender.com` origin remains the live-login acceptance target until the user explicitly changes that requirement. Do not silently substitute `pages.dev` or another host.
2. A deployment is API-capable only when the API endpoint itself returns its documented JSON response and the browser demo flow completes. A static `_routes.json`, HTTP success for the SPA, a local build, or a healthy different hostname is not sufficient evidence.
3. The deployment owner must provide an API-capable route for `/api/*` on that exact origin, with the required origin/CORS configuration if the API is cross-origin. The hosting mechanism is an operator deployment choice; this ADR does not add a Render runtime or deploy production resources.
4. Preserve the current fail-closed demo authentication policy and isolated demo database/book. Do not make the demo succeed by bypassing authentication, seeding production demo rows, or suppressing API errors.
5. Keep live-login acceptance open until `/api/health`, the DB-backed catalog endpoint, and the real-browser **Try the demo** route all pass on the requested origin.

## Alternatives considered

### Silently direct users to the Pages hostname

Rejected for this acceptance: it changes the explicitly requested origin without user approval. A Pages hostname may be a valid separate deployment, but it does not satisfy this record's exact-origin criterion.

### Treat `/_routes.json` as proof that `/api/*` is live

Rejected: the manifest can be served as a static artifact while the actual health path redirects to the SPA. Runtime API responses and the browser journey are authoritative.

### Weaken demo guards or add a client-side fallback

Rejected: that would conceal the deployment failure and could expose production data or issue sessions outside the approved demo environment.

## Consequences

- GOAP-314 remains open for operator routing, isolated demo provisioning, and live browser proof.
- This decision does not claim that Render can execute the current Pages Function; it requires an API-capable route at the exact user-specified origin.
- Any future change to the public demo host or production demo policy requires an explicit decision and a separate security review.
