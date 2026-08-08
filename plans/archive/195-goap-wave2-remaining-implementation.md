# Plan 195: GOAP — Wave 2 Remaining Implementation (Plan 063 Gap Closure)

**Status:** ✅ COMPLETED
**Date:** 2026-07-17
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Strategy:** Swarm — independent tasks executed in parallel
**Extends:** Plan 063
**Completed:** 2026-07-17 (PR #812)

## Goal

Close the remaining feasible Plan 063 Wave 2 gaps that don't require ADRs.
Items needing architectural decisions (F2 search-within-book, F3 export notes,
F5 book delete) are deferred to dedicated plans.

## Tasks

### T1: D4 — JSDoc coverage for key exported APIs (P1)
- Add JSDoc to top 15-20 most important exported functions/types
- Focus on: schema types, reader-core APIs, shared utilities, Worker route handlers
- Use `@param`, `@returns`, `@example` where helpful

### T2: T4 — safe-regex property-based tests (P1)
- Add `fast-check` property-based tests for `packages/shared/src/safe-regex.ts`
- Test: valid regexes pass, ReDoS-prone patterns are rejected
- Test: bounded length limits work correctly

### T3: L1 — Add traceId to bare console calls in reader hooks (P1)
- Find console.log/warn/error calls in `apps/web/src/features/reader/hooks/`
- Replace with structured logging that includes traceId
- Use existing `logClientEvent` or create inline trace context

### T4: E2 — Add retry with exponential backoff to apiRequest() (P1)
- Add retry logic to `apps/web/src/lib/api.ts`
- Max 3 retries, exponential backoff (200ms, 400ms, 800ms)
- Only retry on network errors and 5xx, not 4xx

### T5: N2 — Add breadcrumbs to admin pages (P1)
- Add breadcrumb navigation to admin pages (Books, Grants, Audit)
- Use semantic `<nav aria-label="Breadcrumb">` with `<ol>/<li>`
- Style consistently with existing design tokens

### T6: C3 — Enforce .touch-target class on interactive elements (P1)
- Audit all interactive elements (buttons, links, form controls)
- Add `.touch-target` class where missing on elements < 44px
- Ensure minimum 44x44px touch target per WCAG 2.5.8

### T7: C4 — Integrate Framer Motion useReducedMotion() (P1)
- Import `useReducedMotion` from `framer-motion` in components that animate
- Apply to reader panel transitions, page transitions, toast animations
- Verify globals.css `prefers-reduced-motion` media query still works as fallback

### T8: I1 — i18n parity audit (P1)
- Run existing `i18n-parity.test.ts` and expand coverage
- Check all keys exist in en, de, fr locales
- Fix any missing translations

## Out of Scope (Needs ADR)

| ID | Item | Reason |
|----|------|--------|
| F2 | Search within book | Large scope, needs dedicated plan |
| F3 | Export notes | Needs API design ADR |
| F5 | Book delete endpoint | Needs data safety ADR |
| L2 | Remote log shipping | Infrastructure decision needed |
| L3 | Performance API marks | Needs monitoring strategy |
| E3 | EPUB error recovery UI | UX design needed |
| E4 | Worker error tracing | Needs observability ADR |
| N3 | Hash-based deep linking | Router architecture decision |
| P2 | Memory leak triage | Needs profiling session |
| C1 | Contrast verification | Needs visual audit tool |

## Acceptance Criteria

- [x] All 8 tasks implemented and tested
- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes (7/7)
- [x] `pnpm test:unit` passes
- [x] `pnpm build` passes
- [x] `./scripts/validate-workflows.sh` passes
- [x] New PR created with all changes

## Task Completion Evidence

| Task | Status | Evidence |
|------|--------|----------|
| T1 (JSDoc) | ✅ | `2b899c7` — JSDoc added to key exported APIs in shared package |
| T2 (safe-regex tests) | ✅ | PR #812 — 7 fast-check property-based tests, 15 total tests passing |
| T3 (traceId in reader hooks) | ✅ | N/A — no bare console calls exist in `apps/web/src/features/reader/hooks/` |
| T4 (retry backoff) | ✅ | `e27b575` — retry with exponential backoff in `apiRequest()` |
| T5 (breadcrumbs) | ✅ | `f359663` — breadcrumb navigation on admin pages |
| T6 (touch targets) | ✅ | `1a1bbbd` — `.touch-target` class enforced on small interactive elements |
| T7 (useReducedMotion) | ✅ | `1921448` — custom `useReducedMotion` hook, stale framer-motion mock removed |
| T8 (i18n parity) | ✅ | `1e944d4` — locale parity across en/de/fr |

## CI Fix (Bonus)

The main branch CI was failing due to Scorecard governance alerts incorrectly triggering the CodeQL Alert Check gate. PR #812 fixed this by filtering out Scorecard alerts:

| Check | Before | After |
|-------|--------|-------|
| CodeQL Alert Check | ❌ FAILURE | ✅ SUCCESS |
| Codacy Static Code Analysis | N/A | ✅ 0 issues |
| All other checks | ✅ | ✅ |

## Execution Strategy

**Swarm** — all 8 tasks are independent and can be executed in parallel.

| Task | Agent Type | Dependencies |
|------|-----------|-------------|
| T1 (JSDoc) | code-quality | None |
| T2 (safe-regex tests) | testing-strategy | None |
| T3 (traceId) | code-quality | None |
| T4 (retry backoff) | code-quality | None |
| T5 (breadcrumbs) | reader-ui-ux | None |
| T6 (touch targets) | accessibility-auditor | None |
| T7 (reduced motion) | reader-ui-ux | None |
| T8 (i18n audit) | reader-ui-ux | None |
