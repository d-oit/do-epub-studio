# GOAP-314: Restore live demo login on the advertised Render origin

**Status:** IN PROGRESS — API routing and the live demo-reader journey remain unverified.
**Tracking:** [Issue #1014](https://github.com/d-oit/do-epub-studio/issues/1014) (reopened with current live evidence).
**Decision:** [ADR-1022](1022-adr-api-capable-demo-origin.md).
**Related:** #1261, ADR-252, ADR-1014, `docs/runbooks/infrastructure-setup.md`.

## Goal

The user-specified origin `https://do-epub-studio.onrender.com` must complete **Try the demo** sign-in and reach the authorized demo reader/book. Do not silently substitute another origin or treat the static SPA as a successful API deployment.

## Verified baseline

- A real browser opened `/login`, which resolved to `/index.html`. After clicking **Try the demo** and waiting, the sign-in form remained visible; no reader route was reached.
- `GET https://do-epub-studio.onrender.com/api/health` returned `HTTP/2 301`, `Location: /index.html`, and `Content-Type: text/html`.
- `GET https://do-epub-studio.onrender.com/_routes.json` returned a manifest containing `include: ["/api/*"]`. That static response does not prove the Pages Function executed; the health request is the runtime check.
- The repository runbook describes Cloudflare Pages Functions as the current API-serving architecture. ADR-252 explicitly rejected using Render static hosting to execute the Cloudflare-native Worker.

This is deployment evidence, not evidence of invalid credentials or a login-code defect. The API is not reached, so account/seed behavior and a successful session remain unverified.

## Constraints

- Keep production demo guards, production data, and the isolated preview-demo policy unchanged.
- Do not add a client-side login fallback, hide the failed request, or count a static route manifest as API evidence.
- Do not claim production deployment or live login success without observing the actual target origin.
- The current work records the blocker; an operator with the target hosting configuration must provision the API-capable route. No deployment credentials or production changes are part of this PR.

## Work packages

1. **Record the live blocker — DONE.** Reopen #1014 with the exact browser and HTTP observations; retain the original issue history.
2. **Provide an API-capable route at the required origin — OPEN.** The deployment owner must configure a runtime/proxy that serves `/api/*` for the exact `.onrender.com` origin, including any required API origin/CORS configuration. Keep the user-facing origin unchanged.
3. **Verify the isolated demo runtime — OPEN.** Confirm the demo account, grant, and readable demo book are available only in the approved isolated environment; do not seed production data or relax auth gates.
4. **Prove the live journey — OPEN.** From the exact origin, verify health and catalog JSON, click **Try the demo** in a real browser, and confirm navigation to the demo reader/book with no login error.

## Acceptance criteria

- [ ] `GET https://do-epub-studio.onrender.com/api/health` returns HTTP 200 JSON from the API, not a redirect or SPA document.
- [ ] `GET https://do-epub-studio.onrender.com/api/catalog?limit=1` returns JSON, not the SPA document.
- [ ] A real-browser click on **Try the demo** completes authentication and reaches the authorized demo reader/book on the requested origin.
- [ ] Demo account/book access remains isolated from production data; existing fail-closed guards are unchanged.
- [ ] The live evidence identifies the deployed API/runtime and is linked from the issue before the plan is closed.

## Close rule

Keep this plan **IN PROGRESS** until every acceptance criterion above is observed on the live target. Local mocks, `/_routes.json`, a healthy different hostname, a successful build, or an API health check alone do not complete the browser-login acceptance.
