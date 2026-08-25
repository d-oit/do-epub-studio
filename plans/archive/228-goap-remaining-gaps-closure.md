# GOAP 228: Close Remaining Audit Gaps (O4/O5/O7 residuals + F2 conflict persistence) & Archive Closed Plans

**Date:** 2026-08-11
**Status:** ✅ COMPLETED (merged as PR #965, commit ab3ee7c)
**Baseline:** `main` @ `5a03f4b` (post-GOAP-227, PR #964)
**Related:** Plans 212, 214, 215, 221–227; ADR-005, ADR-212, ADR-214

## What closed where

Four open audit findings were closed in a single PR, plus two stale plan
statuses reconciled and seven fully-complete execution plans archived.

| Finding | Closure | Key files |
| --- | --- | --- |
| O7 (partial) — worker inline error envelopes omit `traceId` | **Closed.** New `apiError(c, status, code, message, headers?)` + `getRequestTraceId(c)` helper centralizes the envelope; every inline non-success response (400/401/403/413/423/429) — middleware auth/body-size/validation, `routes/access.ts`, `routes/admin/auth.ts`, `zValidator` hooks, and the `assertBookAccess` 403 — now carries `error.traceId`. Rate-limit 429s (no Hono `c`) accept an explicit `traceId` param. Contract tests assert `error.traceId === X-Trace-Id` header for 401/400/429. | `apps/worker/src/lib/api-error.ts`, `apps/worker/src/middleware/{auth,body-size-limit,validation,rate-limit}.ts`, `apps/worker/src/routes/{access,telemetry}.ts`, `apps/worker/src/routes/admin/auth.ts`, `apps/worker/src/lib/tenant-isolation.ts`, route call sites |
| O4 (residual) — `persistTelemetry` stores raw client `trace_id`/`span_id` | **Closed.** INSERT now applies `sanitizeTraceId()` to both columns, matching the re-emit path — DB holds only validated, bounded, hex-only ids. Test posts a garbage payload and asserts the persisted row is filtered + truncated. | `apps/worker/src/routes/telemetry.ts`, `apps/worker/src/__tests__/routes.telemetry.test.ts` |
| O5 (partial) — `NotificationBadge` swallows poll failures | **Closed.** New rate-limited `logThrottled(key, entry, intervalMs)` helper; the badge's empty `catch` now emits a `notifications.poll_failed` warn entry at most once per minute. No UI change — the badge stays at 0, the failure is observable. | `apps/web/src/lib/client-logger.ts`, `apps/web/src/features/reader/components/notifications/NotificationBadge.tsx`, `apps/web/src/lib/client-logger.test.ts` |
| F2 (partial) — offline sync conflicts only in memory | **Closed.** `database v3` adds an encrypted `conflicts` store (entity versions encrypted, mirroring the sync queue); `conflict-resolution.ts` is now write-through (serialized chain), with `hydrateConflicts()` loading stored conflicts on demand and resolve/dismiss purging them durably. The panel hydrates before reading pending conflicts and its dismiss path now calls `resolveManualConflict` so the conflict no longer resurrects on reload. Persistence round-trip + purge tests green. | `apps/web/src/lib/offline/db.ts`, `apps/web/src/lib/offline/conflict-resolution.ts`, `apps/web/src/features/reader/components/conflicts/ConflictResolutionPanel.tsx`, `apps/web/src/lib/offline/conflict-resolution.test.ts`, `ConflictResolutionPanel.test.tsx` |

## Plans reconciliation

- `plans/226-goap-verify-gap-closure.md` → `✅ COMPLETED (merged as PR #958, commit d5f5e66)`
- `plans/227-goap-i18n-plural-rules.md` → `✅ COMPLETED (merged as PR #964, commit 5a03f4b)`; all AC boxes `[x]`
- Archived (content-preserving `git mv`, no edits): 212, 214, 215, 221, 222, 223, 224 → `plans/archive/`

## Deferred / gated (unchanged — still tracked in living ADRs)

- R1/R12/N3 email gate, S1–S9, O2, P5, P7 — private security triage (ADR-212/214)
- ADR-217 OTel decision (evaluation ADR stands — deferred)
- ADR-199 plural-rule catalogs — **now COMPLETE** (wired by GOAP-227, PR #964)
- External-URL host allowlist / fetch-level guard for EPUB content — MEDIUM hardening item (per GOAP-224), not a must-fix for the current threat model
