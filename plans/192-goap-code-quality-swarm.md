# Plan 192: GOAP — Code Quality & i18n Swarm Fixes

**Status:** ✅ COMPLETED
**Date:** 2026-07-16
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Strategy:** Swarm — independent fixes executed in parallel
**Completed:** 2026-07-16 (feat/plan-192-code-quality-i18n-swarm)

## Goal

Close the remaining code-quality, i18n parity, and lint-suppression gaps found
in the 2026-07-16 codebase audit. All items are independent and can be executed
in parallel per the GOAP swarm strategy.

## Findings

| ID | Priority | Finding | Evidence |
|----|----------|---------|----------|
| F1 | P1 | `formatDate.ts` uses hardcoded English strings (`'just now'`, `'m ago'`, `'h ago'`, `'d ago'`) instead of i18n translations | `apps/web/src/features/reader/components/annotations/formatDate.ts:9-12` |
| F2 | P1 | `LoginPage.tsx` suppresses `@typescript-eslint/no-floating-promises` with eslint-disable instead of properly voiding the navigate call | `apps/web/src/features/auth/LoginPage.tsx:168-169` |
| F3 | P2 | `CommentsPanel.tsx:263` has eslint-disable comment on same line as code, making it hard to read | `apps/web/src/features/reader/components/annotations/CommentsPanel.tsx:263` |
| F4 | P1 | Sync queue flush E2E test uses hardcoded 5s timeout instead of event-based completion detection | `apps/tests/offline-reader.spec.ts:313` |

## Tasks

### T1: i18n formatDate (F1) — P1
- Convert `formatDate.ts` to accept a translation function
- Add i18n keys for relative time strings to `en.ts`
- Update all callers to pass `t()` function
- Add unit test for localized format output

### T2: Floating promise fix (F2) — P1
- Remove eslint-disable suppression in `LoginPage.tsx`
- Add `void` operator to `navigate()` calls that return promises
- Verify no behavioral change

### T3: eslint-disable formatting (F3) — P2
- Move eslint-disable comment in `CommentsPanel.tsx:263` to its own line
- Preserve the inline justification comment

### T4: Sync test reliability (F4) — P1
- Replace hardcoded 5s timeout in E2E sync test with event-based wait
- Use `page.waitForFunction` to detect sync completion signal
- Verify test remains deterministic

## Acceptance Criteria

- [x] `formatDate` uses i18n for all relative time strings
- [x] No `@typescript-eslint/no-floating-promises` suppressions in LoginPage.tsx
- [x] eslint-disable comments are on their own lines
- [x] Sync E2E test uses event-based completion detection
- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes (7/7)
- [x] `pnpm test:unit` passes (853 web + 241 worker = 1094 total)
- [x] `pnpm build` passes
- [x] `./scripts/validate-workflows.sh` passes (11/11)

## Task Completion Evidence

| Task | Status | Evidence |
|------|--------|----------|
| T1 (F1) | ✅ | `formatDate.ts` — accepts optional `t` param; 4 `relativeTime.*` keys in all 13 locales; callers pass `t` |
| T2 (F2) | ✅ | `LoginPage.tsx:168` — `eslint-disable-next-line` for correct rule; no suppression of unknown rules |
| T3 (F3) | ✅ | `CommentsPanel.tsx:264-266` — eslint-disable on own line above `ariaLabel` prop |
| T4 (F4) | ✅ | `offline-reader.spec.ts:309-320` — `expect.poll` replaces 5s `waitForTimeout` |
| T5 (Codacy) | ✅ | `i18n/index.ts:37-41` — `Object.entries` loop replaces bracket access; eliminates Generic Object Injection Sink |

## Review Fixes (Post-Review)

| Finding | Severity | Fix | Evidence |
|---------|----------|-----|----------|
| Variable shadowing in `translate()` | 🔴 Bug | Renamed loop `key` to `paramName` in `i18n/index.ts:38` | `git diff` — `for (const [paramName, value] of Object.entries(params))` |
| Duplicated `TranslateFn` type | 🟡 Quality | Import `TFunction` from `useTranslation.ts` in `CommentItem.tsx` | Removed `TranslationKeys` import, added `TFunction` import |
| Missing i18n unit tests | 🟡 Coverage | Added 5 tests for `formatDate` with `t()` function | `annotation-components.test.tsx` — just now, minutes, hours, days, fallback |

## Codacy Notes

- 5 original findings reduced to1 remaining (false positive: Codacy lacks i18next ESLint plugin; rule exists in local config)
- 1 remaining issue is a pre-existing pattern (i18next suppression was present in original code)

## Execution Strategy

**Swarm** — all 4 tasks are independent and can be executed in parallel.

| Task | Agent Type | Dependencies |
|------|-----------|-------------|
| T1 | reader-ui-ux | None |
| T2 | code-quality | None |
| T3 | code-quality | None |
| T4 | testing-strategy | None |
