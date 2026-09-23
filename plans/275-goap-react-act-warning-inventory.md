# GOAP-275: React `act(...)` warning inventory (web test suite)

**Status:** IN PROGRESS (Phase 1 partially landed: #1175's three warning classes fixed; remaining inventory tracked here)
**Date:** 2026-09-23
**ADR:** `plans/275-adr-react-act-warning-policy.md`
**Issue:** #1185 (tracking) — discovered while fixing #1175

## Context

Issue #1175 named three warning classes on the admin books page (`act(...)`,
missing `key`, `isLoading` on a DOM element). Fixing them required the suite to
be run with `--reporter=verbose --silent=false`: the default reporter shows no
`stderr` blocks at all, so **the gate is green while React warnings accumulate
invisibly** (verified: the same revision prints 61 `stderr` blocks verbose and
zero by default).

The same verbose run surfaced ~114 further `act(...)` warnings across 12 files —
state updates that land after the test body ends. They do not fail any check
today, and they mask real state-timing bugs (the warning fires exactly when a
component updates outside the test's awaited boundary).

| File | Warnings | Pattern |
|------|---------:|---------|
| `src/features/reader/ReaderPage.test.tsx` | 82 | 9 per panel/theme test: the reader hook's async load settles after the test body |
| `src/features/reader/hooks/useReaderSearch.test.ts` | 8 | 2-4 per concurrency test: the search promise resolves after assertions |
| `src/__tests__/storage-quota.test.tsx` | 7 | 6 in "shows clearing text…", 1 auto-dismiss timer |
| `src/features/reader/components/toolbar/ReaderToolbar.test.tsx` | 4 | focus-management tests update state outside `act` |
| `src/__tests__/notification-panel.test.tsx` | 3 | dialog render updates |
| `src/hooks/useSessionExpiry.test.ts` | 2 | telemetry logging |
| `src/__tests__/useTranslation.test.ts` | 2 | locale change |
| `src/__tests__/admin-recover-page.test.tsx` | 2 | loading state during verify submit |
| `src/__tests__/account-settings-page.test.tsx` | 2 | change-password form render |
| `src/features/admin/AuditLogPage.test.tsx` | 1 | filter controls render |
| `src/components/__tests__/SwUpdateNotification.test.tsx` | 1 | exit animation |

Fixed in this change set (#1175 scope): `BooksPage.archive.test.tsx` (raw
`.click()` outside `act`), `BooksPage.render.test.tsx` (synchronous assertion on
an async load), `TableOfContents.tsx` (unkeyed `map` in the non-virtualized
list), `books-page.test.tsx` (mock `Button` forwarding `isLoading` to the DOM).

## Decision (policy)

See ADR-275. Short form: warnings are defects, not noise; the count must fall
monotonically and may never grow; suppression is not a fix.

## Phases

| # | Phase | Exit criteria | Status |
|---|-------|---------------|--------|
| 1 | Fix the #1175 classes | The four touched files emit zero `stderr` blocks under `--reporter=verbose --silent=false`; suite green | DONE (this PR) |
| 2 | CI-visible warning sensor | A script/reporter compares the `act(...)`/`key`/unknown-prop warning count against a committed baseline and fails when it grows; wired into `ci.yml` + `quality_gate.sh` | NOT STARTED |
| 3 | Drain the inventory, worst file first | `ReaderPage.test.tsx` (82) → `useReaderSearch` (8) → `storage-quota` (7) → the six ≤4-warning files; each file emits zero warnings and keeps its assertions' intent | NOT STARTED |
| 4 | Synthesis | Baseline reaches zero and is then removed; issue #1185 closed; learnings recorded (Tier 2 #12) | NOT STARTED |

## Acceptance

- Phase 1 is verifiable today: `cd apps/web && pnpm exec vitest run <file>
  --reporter=verbose --silent=false` prints no `stderr` block for the touched files.
- Phase 2 must fail closed: an unreadable count is a failure, not a pass.
- Phase 3 must not weaken assertions to silence a warning (no `act` wrapping of
  an assertion that no longer asserts, no `console.error` stubs).

## Related

- #1175 — the three warning classes fixed here.
- #1185 — tracking issue for the remaining inventory.
- GOAP-241 — earlier warning-closure plan (same "warnings are defects" stance).
- `agents-docs/LEARNINGS.md` — the default-reporter silence is captured there.
