# Admin Audit Endpoint: Active Route and Removed Alias

**Date:** 2026-07-09
**Status:** Accepted (Plan 121 M5 / `docs/audit-logs-alias`)
**Source of truth:** `apps/worker/src/routes/admin/audit.ts` + `apps/worker/src/__tests__/routes.admin.test.ts`

---

## Context

Plan 115 surfaced item **M5** as " `/api/admin/audit-logs` 301 alias — document
as intentional." The plan's intent was a 301 redirect from the legacy
`/api/admin/audit-logs` path to the canonical `/api/admin/audit` route.

The actual implementation went one step further: the legacy path returns
**404 (not found)**, with a test pinning that exact response. This document
records the implemented decision so future contributors do not "fix" the 404
by re-introducing the path or wiring up a redirect.

## Decision

> **`GET /api/admin/audit` is the active route. `GET /api/admin/audit-logs`
> returns 404 by design. There is no 301 redirect.**

| Path                         | Status | Source                                          |
|------------------------------|--------|-------------------------------------------------|
| `GET /api/admin/audit`       | 200    | `apps/worker/src/routes/admin/audit.ts`        |
| `GET /api/admin/audit-logs`  | 404    | (no route handler; pinned by `routes.admin.test.ts`) |
| Underlying SQL table         | —      | `audit_log` (queried in `audit.ts` + `stats.ts`) |

## Why 404 (not 301)

- **No production callers.** The frontend has been updated to call
  `/api/admin/audit` directly. There are no remaining `audit-logs` requests
  in the application's own code path.
- **404 surfaces bugs.** A silent 301 would mask caller-side mistakes
  (a forgotten migration, a stale link in a doc, a leaked old bookmark).
  A 404 forces the caller to update their code path.
- **The test pins the behavior.** The dedicated test
  `routes.admin.test.ts > GET /api/admin/audit-logs > returns 404 — redirect
  removed, frontend calls /audit directly` makes the 404 a load-bearing
  invariant. Removing the test would be a regression; the test passes today
  and is in the standard CI matrix.
- **Cleaner router surface.** A router with no dead route handlers is
  easier to read and to security-review. A 301-redirect stub would be a
  permanent attractor for analysis without value.

## What this doc replaces

The Plan 115 description used the phrase *"301 alias"*; that was the design
intent at planning time. The implementation chose 404 (cleaner). Plan 121's
M5 row was therefore phrased against a stale intent; the row is now struck
through as **RESOLVED** with this document as the canonical artifact.

## When to reconsider

- A new caller surfaces that genuinely needs the legacy path
  (e.g., an external system that integrates with the project). In that case
  the answer is *not* a 301 redirect, but rather a new top-level
  `/api/admin/audit-logs` route handler that returns the same shape as
  `/api/admin/audit` (so the legacy client gets full functionality, not
  silent forwarding).
- The frontend's audit-log viewer is split into per-entity views
  (`/audit?entityType=...`) and a separate canonical endpoint is needed.
  Then keep `/api/admin/audit` as the unified entry point.
- A bulk-import tool needs to enumerate audit entries by date range. Use
  the existing `from` / `to` filters on `/api/admin/audit` rather than
  re-introducing the legacy path.

## Related

- **Plan 121 (M5)** — entry this doc closes.
- **Plan 115** — origin plan for M5; this doc supersedes its "301 alias"
  phrasing.
- **apps/worker/src/routes/admin/audit.ts** — canonical route handler.
- **`apps/worker/src/__tests__/routes.admin.test.ts`** — pins the 404
  invariant (test description: "returns 404 — redirect removed, frontend
  calls /audit directly").
- **apps/worker/src/audit.ts** — `logAudit()` utility used by every other
  admin route to record actions.
