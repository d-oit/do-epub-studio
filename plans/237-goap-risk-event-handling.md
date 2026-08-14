# GOAP-237: ADR-234 Item 7 — Risk-Event Handling + Pre-Existing Cleanup

**Date:** 2026-08-14
**Status:** In Progress
**Baseline:** `main` @ `a3827d5` (post GOAP-236, PR #975)
**Related:** ADR-212, ADR-214, ADR-230, ADR-231, ADR-234; Plans 230, 236; audit/risk infra map

## Goal

Close the last open ADR-234 follow-up (item 7: **risk-event handling**) and ship
verified pre-existing cleanup in a single CI-green PR.

ADR-234 item 7 requires risk-event handling for: impossible travel signals if
available, **repeated failed login/reset attempts**, **token replay**, and
**suspicious device changes**. Risk events must be observable but observational
(no behavioral lockout change) so auth flows are not destabilized.

## Analysis (verified against source)

Reconnaissance (`apps/worker/src`, `packages/schema`) established:

- Audit events are written via `logAudit(env, entry, ctx)` in
  `apps/worker/src/audit/index.ts` into `audit_log`. Event `action` strings are
  **free-form inline** (e.g. `admin_reset_denied`, `mfa_auth_failure`,
  `step_up_failure`) — there is **no centralized event-name enum**.
- Replay detection already exists (single-use) but surfaces only as generic
  denied/failure events, not a dedicated `token_replay` risk event:
  - reset tokens `auth/reset.ts` (`used_at` single-use; reader + admin).
  - mfa login tickets `auth/mfa.ts` `consumeLoginTicket` (single-use).
  - recovery codes `auth/mfa.ts` `verifyRecoveryCode` (rewrite-on-match).
- Failed-attempt/lockout counters live **in-memory in the RATE_LIMITER Durable
  Object** (per-account `auth_lockout` → 423 ACCOUNT_LOCKED); not durable or
  queryable.
- `admin_sessions.device_label_hash` exists but is **never populated**; no IP /
  user-agent persisted. `reader_sessions` has no device/ip/ua columns.
- Audit query (`routes/admin/audit.ts` + `AuditQuerySchema` in
  `packages/schema/src/schemas.ts`) filters only by
  entityType/entityId/from/to — **no `action` filter**, so risk events are not
  queryable.

## Decomposition

| Task | Scope | Files (ownership) |
| --- | --- | --- |
| R1 | `logRiskEvent` + centralized risk event-name constants (`facility: 'risk'` naming, `risk_<kind>`) | `apps/worker/src/audit/risk.ts` (new), `audit/index.ts` |
| R2 | Token-replay risk events at the 3 single-use replay points (reset used / login-ticket reuse / recovery-code reuse) | `routes/admin/auth.ts`, `routes/access.ts`, `auth/mfa.ts` |
| R3 | Repeated-failed-attempt / lockout risk event when auth lockout triggers (reader + admin) | `routes/access.ts`, `routes/admin/auth.ts` |
| R4 | Suspicious device change: populate `device_label_hash` + new `ip_hash` on admin session mint; emit risk event when new session device/IP unseen among active sessions (observational) | `auth/admin-middleware.ts`, `routes/admin/auth.ts`, `packages/schema/migrations/0012-*.sql` |
| R5 | Risk-event query surface: optional `action` filter on `AuditQuerySchema` + audit route | `packages/schema/src/schemas.ts`, `routes/admin/audit.ts` |
| C1 | Dead-code removal (verified unimported): `schema/constants.ts`, `worker/src/auth/index.ts`, `db/index.ts`, `storage/index.ts` barrels, `auth/password.ts revokeGrant`, `lib/redact.ts scrubForLog`, `packages/ui/src/toast.tsx toast()` stub, `useReaderHandlers.ts` duplicate | cleanup agent |
| C2 | Doc drift: `docs/offline.md`, `docs/reading-insights.md`, `plans/ADR-INDEX.md`, `plans/archive/179/181/183/185` statuses, escaped-markdown in 231–234 ADRs, vite.config whitespace | cleanup agent |

**Out of scope this PR (deferred, still tracked):** R1/R12/N3 email gate,
S1–S9, O2, P5/P7 (private security triage per ADR-212/214); ADR-217 OTel
decision; reader-core public-API helper removal (toc/epub-loader/locator/
sanitizer — published package surface, no consumers to justify deletion).

## Acceptance Criteria

- [x] `logRiskEvent` emits `risk_<kind>` audit entries with `facility: 'risk'` and sanitized payloads (no tokens/passwords/IP, only `ipHash`).
- [x] Reused reset token / login ticket / recovery code emit `risk_token_replay` (reader + admin paths).
- [x] Auth lockout trigger emits `risk_login_locked` without changing lockout behavior.
- [x] Admin session mint populates `device_label_hash` + `ip_hash`; new unseen device/IP emits `risk_suspicious_device_change` (observational).
- [x] `GET /api/admin/audit?action=risk_*` returns risk events (`action` filter added, backward compatible).
- [x] Migration `0012` applied cleanly by the migration runner; schema/worker tests green.
- [x] Dead code removals leave `pnpm lint`, `pnpm typecheck`, worker/web/schema unit suites and `knip` green.
- [x] `./scripts/quality_gate.sh` exits 0 (or per documented CI smoke env); full CI green on the PR.
- [x] Plans/docs updated; ADR-234 closure record records item 7.
