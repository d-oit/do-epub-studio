# GOAP-275: React `act(...)` warning inventory (web test suite)

**Status:** IN PROGRESS (Phases 1–2 landed: #1175's warning classes fixed in PR #1186, warning sensor live; remaining inventory tracked here)
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
| 1 | Fix the #1175 classes | The four touched files emit zero `stderr` blocks under `--reporter=verbose --silent=false`; suite green | DONE (PR #1186) |
| 2 | CI-visible warning sensor | A committed file inventory plus a guard that fails any file emitting a tracked warning outside it; wired into `test:unit` so the quality gate and CI both enforce it; fail-closed when the emitting file cannot be attributed | DONE (this PR: `apps/web/src/test-utils/react-warning-guard.ts` + 11-entry inventory + unit tests; guard verified non-vacuous and green across default ×2 and `--coverage` run shapes) |
| 3 | Drain the inventory, worst file first | `ReaderPage.test.tsx` → `useReaderSearch` → `storage-quota` → the remaining eight files; each file emits zero warnings, its inventory entry is deleted, and its assertions keep their intent | NOT STARTED |
| 4 | Synthesis | The inventory is empty and then removed; issue #1185 closed; learnings recorded (Tier 2 #12) | NOT STARTED |

## Why the sensor is file-level, not a count baseline

The plan originally called for a numeric baseline. Measurement killed that idea:
one revision reported **13**, **34** and **82** `act(...)` warnings depending on
run shape (single file vs full suite) and reporter (custom vs verbose) — the
count depends on how much async work lands after a test body under load, so a
numeric baseline would flake. *Which files* warn is stable, so the guard keys on
file identity: 11 inventoried files are tolerated, anything else fails.

## Acceptance

- Phase 1 is verifiable today: `cd apps/web && pnpm exec vitest run <file>
  --reporter=verbose --silent=false` prints no `stderr` block for the touched files.
- Phase 2 is verifiable today: deleting an entry from `KNOWN_WARNING_FILES`
  fails that file with an actionable message (checked for
  `src/hooks/useSessionExpiry.test.ts`, exit 1); a warning whose file cannot be
  attributed fails as `<unknown file>`; and the guard never suppresses output —
  every `console.error` call is forwarded to the original.
- Phase 3 must not weaken assertions to silence a warning (no `act` wrapping of
  an assertion that no longer asserts, no `console.error` stubs).

## Related

- #1175 — the three warning classes fixed here.
- #1185 — tracking issue for the remaining inventory.
- GOAP-241 — earlier warning-closure plan (same "warnings are defects" stance).
- `agents-docs/LEARNINGS.md` — the default-reporter silence is captured there.
