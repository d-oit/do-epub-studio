# Plan 196: GOAP — Plan 195 Actual Implementation (Wave 2 Gap Closure)

**Status:** ✅ COMPLETED
**Date:** 2026-07-17
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Strategy:** Swarm — independent tasks executed in parallel
**Extends:** Plan 195
**Branch:** `feat/plan-195-wave2-remaining-impl`

## Goal

Plan 195 claimed completion but 5 of 8 tasks were never merged to main.
This plan implements the actual remaining tasks.

## Audit Results

| Task | Plan 195 Claim | Actual on Main | Action |
|------|---------------|----------------|--------|
| T1 (JSDoc) | ✅ commit 2b899c7 | ❌ No JSDoc in shared | ✅ Implemented |
| T2 (safe-regex tests) | ✅ PR #812 | ✅ 15 fast-check tests | None |
| T3 (traceId hooks) | ✅ N/A | ✅ logClientEvent in hooks | None |
| T4 (retry backoff) | ✅ commit e27b575 | ❌ No retry in apiRequest | ✅ Implemented |
| T5 (breadcrumbs) | ✅ commit f359663 | ❌ No breadcrumbs | ✅ Implemented |
| T6 (touch targets) | ✅ commit 1a1bbbd | ⚠️ CSS class exists, not applied | ✅ Implemented |
| T7 (useReducedMotion) | ✅ commit 1921448 | ❌ Only inline checks | ✅ Implemented |
| T8 (i18n parity) | ✅ commit 1e944d4 | ✅ Locales aligned, test exists | None |

## Task Completion Evidence

| Task | Status | Evidence |
|------|--------|----------|
| T1 (JSDoc) | ✅ | JSDoc added to 20+ exports in telemetry.ts, errors.ts, safe-regex.ts, dtos.ts, epub-validator.ts |
| T4 (retry backoff) | ✅ | apiRequest() retries 3x with exponential backoff (200/400/800ms) on network errors and 5xx |
| T5 (breadcrumbs) | ✅ | Breadcrumb component + i18n keys in 13 locales + added to 4 admin pages |
| T6 (touch targets) | ✅ | .touch-target class applied to small interactive elements in BooksPage, AuditLogPage |
| T7 (useReducedMotion) | ✅ | useReducedMotion hook + getPrefersReducedMotion utility; integrated into useReaderEpub.ts |

## Acceptance Criteria

- [x] JSDoc on 20+ key exported functions
- [x] apiRequest() retries 3x on network/5xx errors
- [x] Admin pages have breadcrumb navigation
- [x] Small interactive elements have touch-target class
- [x] useReducedMotion hook exists and is used
- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes (7/7)
- [x] `pnpm test:unit` passes (862 web tests)
- [x] `pnpm build` passes
- [x] `./scripts/validate-workflows.sh` passes (11/11)

## Files Modified

| File | Change |
|------|--------|
| `packages/shared/src/telemetry.ts` | JSDoc for createTraceId, createSpanId, serializeError, SerializedError |
| `packages/shared/src/errors.ts` | JSDoc for AppError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, RateLimitError |
| `packages/shared/src/safe-regex.ts` | JSDoc for matchBounded, testBounded, matchAllBounded, escapeRegex |
| `packages/shared/src/dtos.ts` | JSDoc for ApiError, ApiResponse, BookResponse, AccessResponse, ReaderCapabilities, SignedUrlResponse |
| `packages/shared/src/epub-validator.ts` | JSDoc for ValidationResult, validateEpub |
| `apps/web/src/lib/api/index.ts` | Retry with exponential backoff (MAX_RETRIES=3, 200/400/800ms) |
| `apps/web/src/hooks/useReducedMotion.ts` | React hook for prefers-reduced-motion |
| `apps/web/src/lib/reduced-motion.ts` | Standalone utility for imperative contexts |
| `apps/web/src/components/navigation/Breadcrumb.tsx` | New breadcrumb component |
| `apps/web/src/components/navigation/index.ts` | Export Breadcrumb |
| `apps/web/src/features/admin/AdminDashboardPage.tsx` | Add breadcrumb |
| `apps/web/src/features/admin/BooksPage.tsx` | Add breadcrumb + touch-target classes |
| `apps/web/src/features/admin/GrantsPage.tsx` | Add breadcrumb |
| `apps/web/src/features/admin/AuditLogPage.tsx` | Add breadcrumb + touch-target classes |
| `apps/web/src/features/reader/hooks/useReaderEpub.ts` | Use getPrefersReducedMotion utility |
| `apps/web/src/i18n/en.ts` | Add breadcrumb i18n keys |
| `apps/web/src/i18n/{de,fr,ar,es,hi,it,ja,ko,nl,pt,ru,zh}.ts` | Add breadcrumb i18n keys |

## Execution Strategy

**Swarm** — all 5 tasks are independent and were executed in parallel.

| Task | Agent Type | Dependencies |
|------|-----------|-------------|
| T1 (JSDoc) | code-quality | None |
| T4 (retry backoff) | code-quality | None |
| T5 (breadcrumbs) | reader-ui-ux | None |
| T6 (touch targets) | accessibility-auditor | None |
| T7 (useReducedMotion) | reader-ui-ux | None |
