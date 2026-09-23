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
5. **The inventory may not grow.** Phase 2 of GOAP-275 adds a committed baseline
   and a CI check that fails when the count increases; an unreadable count fails
   closed. The baseline is deleted when it reaches zero.

## Consequences

- The suite's real signal (state-timing correctness) is restored, and the
  ReaderPage/reader-hook tests stop hiding update-after-assert bugs.
- Phase 3 is real work: 12 files, dominated by `ReaderPage.test.tsx` (82 of
  ~114 warnings).
- The loud invocation is slower to read and noisier for unrelated console
  output, so it is used when fixing tests rather than as the default developer
  loop; Phase 2's sensor gives the same coverage without the noise.
- Until Phase 2 lands, warning-free status depends on reviewer diligence —
  documented here so the gap is a known, bounded debt rather than an assumption.
