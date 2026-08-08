# GOAP 207: Missing Implementation Cleanup — Logging, Error Handling, Code Quality

**Date:** 2026-08-01
**Status:** ✅ COMPLETED
**PR:** [#893](https://github.com/d-oit/do-epub-studio/pull/893)
**Goal:** Close remaining code quality gaps found in plans/ audit: replace raw console.* with structured logging in worker, fix swallowed errors, remove test debug logs, and improve success return patterns. All CI must pass.

**Related:** Plan 202 (verification), Plan 206 (wave 6 dead code), ADR-067 (observability)

## 1. Analysis

### Findings from Audit

| ID | Gap | Priority | Location | Fix |
|----|-----|----------|----------|-----|
| L1 | Swallowed R2 deletion error — `.catch(() => undefined)` silently drops failures | P1 | `apps/worker/src/routes/admin/books.ts:328` | Log the error via observability before swallowing |
| L2 | Raw `console.error` in admin auth failures — bypasses structured logging | P1 | `apps/worker/src/auth/admin-middleware.ts:101` | Replace with `logClientEvent` or structured log |
| L3 | Raw `console.error` in rate limiter — bypasses structured logging | P1 | `apps/worker/src/lib/rate-limit-client.ts:46,64` | Replace with structured log |
| L4 | Raw `console.error` in insights sync — bypasses structured logging | P1 | `apps/worker/src/routes/reader/insights.ts:94` | Replace with structured log |
| L5 | Raw `console.log`/`console.warn` in email transport fallback — bypasses structured logging | P2 | `apps/worker/src/lib/email-transport.ts:17,53` | Replace with structured log |
| L6 | Debug `console.log` left in test code | P2 | `apps/worker/src/__tests__/recovery.test.ts:36` | Remove or use test reporter |
| L7 | Stub `return {}` success pattern in GrantsPage form action | P3 | `apps/web/src/features/admin/GrantsPage.tsx:133` | Return meaningful success indicator |

### Out of Scope (Documented Limitations)
- VirtualList variable-height — explicitly not implemented (design decision)
- i18n plural rules — deferred per ADR-199
- Service Worker console.* — no structured logger available in SW context
- reader-core console.error — library package with no logger dependency
- `any` casts in epub-loader — epubjs typing limitations

## 2. Decomposition

| Task | Priority | Deps | Skill |
|------|----------|------|-------|
| T1: Fix swallowed R2 deletion error (L1) | P1 | None | `code-quality` |
| T2: Replace console.error in admin-middleware with structured logging (L2) | P1 | None | `code-quality` |
| T3: Replace console.error in rate-limit-client with structured logging (L3) | P1 | None | `code-quality` |
| T4: Replace console.error in insights.ts with structured logging (L4) | P1 | None | `code-quality` |
| T5: Replace console.log/warn in email-transport with structured logging (L5) | P2 | None | `code-quality` |
| T6: Remove debug console.log in recovery test (L6) | P2 | None | `code-quality` |
| T7: Improve GrantsPage success return (L7) | P3 | None | `code-quality` |
| G1: Run quality gate | P1 | T1-T7 | — |
| G2: Create PR + address CI feedback | P1 | G1 | `github-workflow` |
| G3: Review and roast PR | P1 | G2 | `code-review-assistant` |

## 3. Execution Strategy

**Parallel Swarm** — All tasks T1-T7 are independent (different files, no dependencies).

### Phase 1: Implementation (Parallel Swarm)
- T1 + T2 + T3 + T4 + T5 + T6 + T7 — all parallel

### Phase 2: Validation (Sequential)
- G1: Quality gate
- G2: Create PR, monitor CI, address feedback

### Phase 3: Review (Sequential)
- G3: Review and roast the PR

## 4. Acceptance Criteria
- [x] R2 deletion errors are logged (not silently swallowed) — PR #887
- [x] All worker console.* calls route through structured logging — PR #888 (L4) + PR #893 (L2, L3, L5)
- [x] Debug logs removed from test code — PR #887
- [x] GrantsPage returns meaningful success indicator — PR #887
- [x] `./scripts/quality_gate.sh` passes
- [x] PR created and CI green — PR #893
- [x] PR reviewed and feedback addressed
