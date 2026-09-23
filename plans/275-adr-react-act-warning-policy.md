# ADR-275: React warnings in the web test suite are defects, not noise

**Date:** 2026-09-23
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** GOAP-275, GOAP-241, issue #1175, issue #1185, ADR-034

## Context

Vitest's default reporter prints no `stderr` blocks for passing test files, so
React's development warnings (`act(...)`, missing `key`, unknown DOM props) are
invisible in the gate and in CI. Measured on one revision of `apps/web`:

| Invocation | `stderr` blocks |
|------------|----------------:|
| `pnpm exec vitest run` (default reporter) | 0 |
| `pnpm exec vitest run --reporter=verbose --silent=false` | 61 |

That gap let ~114 `act(...)` warnings accumulate across 12 files while every
check stayed green. Each warning is a real signal: React emits it when a
component updates state outside the test's awaited boundary, i.e. when the test
asserts before the behaviour it claims to verify has settled.

## Decision

1. **Warnings are defects.** An `act(...)`, missing-`key`, or unknown-DOM-prop
   warning in the web suite is treated as a bug in the test or the component,
   not as tolerable noise.
2. **Fix on touch.** Any change set that touches a test file or component
   emitting these warnings leaves that file warning-free in the same change set,
   or the warning is tracked in GOAP-275 with a linked issue.
3. **Verify with the loud invocation.** Test fixes are verified with
   `pnpm exec vitest run --reporter=verbose --silent=false` (or the Phase-2
   sensor); a green default-reporter run is not evidence that a warning is gone.
4. **Never suppress.** `console.error` stubs, reporter silencing, or widening
   `act` boundaries around assertions that no longer assert are prohibited —
   the same stance ADR-187 takes for skipped gate phases.
5. **The inventory may not grow.** Phase 2 of GOAP-275 enforces a committed
   **file inventory** (`KNOWN_WARNING_FILES`) via a guard installed in the web
   test setup: a file that emits a tracked warning and is not listed fails its
   own test file, so `test:unit` — and therefore the quality gate and CI — fail.
   Entries are deleted as each file is drained; the list is removed entirely when
   it empties. A warning that cannot be attributed to a file fails closed
   (`<unknown file>`).
   The sensor keys on file identity, **not** on counts: one revision reported 13,
   34 and 82 `act(...)` warnings across single-file/full-suite and
   custom/verbose-reporter runs, so any numeric baseline would flake, while the
   set of warning-emitting files is stable.

## Consequences

- The suite's real signal (state-timing correctness) is restored, and the
  ReaderPage/reader-hook tests stop hiding update-after-assert bugs.
- Phase 3 is real work: 11 files remain inventoried, dominated by
  `ReaderPage.test.tsx` (the largest warning source in every run shape).
- The loud invocation is slower to read and noisier for unrelated console
  output, so it is used when fixing tests rather than as the default developer
  loop; the Phase-2 guard gives the same coverage without the noise, and it runs
  in every `test:unit` invocation (local, gate, CI) because it is wired through
  the web test setup rather than a separate CI step.
- A file that emits a tracked warning *only* under load fails when it does — the
  strictness is intentional, and the remedy is a GOAP-275 inventory entry, not a
  retry. Three run shapes (default ×2, `--coverage`) were green when the sensor
  landed, so the current inventory is complete for this revision.
