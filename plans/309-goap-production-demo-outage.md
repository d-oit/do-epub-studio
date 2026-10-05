# GOAP-309: Production demo login and catalog outage on do-epub-studio.pages.dev

**Status:** IN PROGRESS — W3+W5 shipped (2026-10-04); W1 (ops config) and W2 (catalog 500 root cause) still require Cloudflare access (#1278)
**ADR:** this file carries the ADR (policy in §4) until promoted.

## 1. Analyze — measured production evidence (2026-10-04, headless Chrome against https://do-epub-studio.pages.dev)

| Probe                                                            | Result                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `GET /api/health`                                                | 200 `application/json` `{"ok":true}` — Functions routing works            |
| `GET /api/catalog?limit=3`                                       | **500 `INTERNAL_ERROR`** (traceId `6ae83aac-…`) — catalog DB path is down |
| `POST /api/demo/reader-login`                                    | 403 `DEMO_DISABLED` — fail-closed gates (expected without config)         |
| `POST /api/access/request` (demo.reader creds, `bookSlug: demo`) | **500 `INTERNAL_ERROR`** (traceId `5e13c439-…`)                           |
| UI "Try the demo" button                                         | Alert "Demo login is not available." — dead end for end users             |
| UI `/login?book=demo` + "Fill demo credentials" + Sign In        | Alert "An unexpected error occurred" (the 500 surfaces raw)               |

## 2. Goal

An end user on the public Pages deployment can enter the demo reader experience
(or sees a deliberate, honest "demo unavailable" state — not a broken button),
and `/api/catalog` returns 200 JSON.

## 3. Decompose

- **W1 (root cause, ops):** Pages project env lacks `DEMO_LOGIN_ENABLED=1` and
  `DEMO_ACCOUNTS_PROD_ALLOWLIST`; without them `isProductionLike()` in
  `apps/worker/src/routes/demo.ts` fail-closes. Decision needed: is the public
  demo supposed to be enabled on pages.dev? The web UI ships the demo buttons
  unconditionally (product direction 2026-08-23), so the current production
  state is self-contradictory.
- **W2 (root cause, bug):** `/api/catalog` 500 on production while `/api/health`
  is green. Health does not exercise the DB path, so a broken D1/Turso binding
  or a failing query ships silently. Diagnose via the traceId in Workers Logs;
  likely the Pages Functions D1 binding or migration state.
- **W3 (UX honesty):** When demo endpoints 403/500, the login page still
  advertises "Try the demo" prominently. Either hide the block when the server
  fail-closes (a cheap `GET` probe or a config endpoint), or map `DEMO_DISABLED`
  to a friendly, non-error explanation.
- **W4 (error contract):** `/api/access/request` and `/api/catalog` return bare
  500 `INTERNAL_ERROR` for what are configuration/data problems. Add structured
  error codes so the UI can distinguish "no such grant" from "server on fire".
- **W5 (regression cover):** `apps/tests/cloudflare-login.spec.ts` asserts
  health JSON but not catalog 200. Add a production smoke assertion for
  `/api/catalog?limit=1` returning 200 (exists in PR #1262's release-workflow
  check — extend the Playwright lane too).

## 4. ADR — policy decisions

- **D1:** Demo buttons must not render a dead end. If the server fail-closes
  the demo, the UI either hides the demo block or explains the state. A
  prominent button that always errors is a defect, not a security posture.
- **D2:** Production smoke coverage must include at least one DB-backed read
  endpoint (`/api/catalog?limit=1`), not only `/api/health`.
- **D3:** Enabling the demo on the public Pages deployment is an explicit,
  allowlisted ops action (`DEMO_LOGIN_ENABLED=1` +
  `DEMO_ACCOUNTS_PROD_ALLOWLIST` in the Pages project settings) — never a code
  default. Documented in `docs/runbooks/infrastructure-setup.md`.

## 5. Coordinate / Execute

Tracking issue: #1278. W2 blocks the public demo regardless of W1's decision.

## 6. Synthesize

Pending — fill after W1–W5 land.
