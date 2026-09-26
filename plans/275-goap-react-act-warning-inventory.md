# GOAP-275: React `act(...)` warning inventory (web test suite)

**Status:** PHASE 3 COMPLETE — all 11 inventoried files drained, `KNOWN_WARNING_FILES` is now empty (2026-09-25). Phase 4 synthesis still open; issue #1185 stays open until it is recorded.
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

| File                                                            | Warnings | Pattern                                                                          |
| --------------------------------------------------------------- | -------: | -------------------------------------------------------------------------------- |
| `src/features/reader/ReaderPage.test.tsx`                       |       82 | 9 per panel/theme test: the reader hook's async load settles after the test body |
| `src/features/reader/hooks/useReaderSearch.test.ts`             |        8 | 2-4 per concurrency test: the search promise resolves after assertions           |
| `src/__tests__/storage-quota.test.tsx`                          |        7 | 6 in "shows clearing text…", 1 auto-dismiss timer                                |
| `src/features/reader/components/toolbar/ReaderToolbar.test.tsx` |        4 | focus-management tests update state outside `act`                                |
| `src/__tests__/notification-panel.test.tsx`                     |        3 | dialog render updates                                                            |
| `src/hooks/useSessionExpiry.test.ts`                            |        2 | telemetry logging                                                                |
| `src/__tests__/useTranslation.test.ts`                          |        2 | locale change                                                                    |
| `src/__tests__/admin-recover-page.test.tsx`                     |        2 | loading state during verify submit                                               |
| `src/__tests__/account-settings-page.test.tsx`                  |        2 | change-password form render                                                      |
| `src/features/admin/AuditLogPage.test.tsx`                      |        1 | filter controls render                                                           |
| `src/components/__tests__/SwUpdateNotification.test.tsx`        |        1 | exit animation                                                                   |

All eleven inventoried files have been drained — every inventory entry deleted,
each file emitting zero tracked warnings under `--reporter=verbose
--silent=false`. See "Phase 3 evidence" below.

Fixed in this change set (#1175 scope): `BooksPage.archive.test.tsx` (raw
`.click()` outside `act`), `BooksPage.render.test.tsx` (synchronous assertion on
an async load), `TableOfContents.tsx` (unkeyed `map` in the non-virtualized
list), `books-page.test.tsx` (mock `Button` forwarding `isLoading` to the DOM).

## Decision (policy)

See ADR-275. Short form: warnings are defects, not noise; the count must fall
monotonically and may never grow; suppression is not a fix.

## Phases

| #   | Phase                                 | Exit criteria                                                                                                                                                                                                                 | Status                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fix the #1175 classes                 | The four touched files emit zero `stderr` blocks under `--reporter=verbose --silent=false`; suite green                                                                                                                       | DONE (PR #1186)                                                                                                                                                                                                                                                                                                                                            |
| 2   | CI-visible warning sensor             | A committed file inventory plus a guard that fails any file emitting a tracked warning outside it; wired into `test:unit` so the quality gate and CI both enforce it; fail-closed when the emitting file cannot be attributed | DONE (this PR: `apps/web/src/test-utils/react-warning-guard.ts` + 11-entry inventory + unit tests; guard verified non-vacuous and green across default ×2 and `--coverage` run shapes)                                                                                                                                                                     |
| 3   | Drain the inventory, worst file first | `ReaderPage.test.tsx` → `useReaderSearch` → `storage-quota` → the remaining eight files; each file emits zero warnings, its inventory entry is deleted, and its assertions keep their intent                                  | DONE (2026-09-25: all 11 files drained over two tranches; `KNOWN_WARNING_FILES` is now empty and the guard also learned a 4th class — see "Phase 3 evidence")                                                                                                                                                                                              |
| 4   | Synthesis                             | The inventory is empty and then removed; issue #1185 closed; learnings recorded (Tier 2 #12)                                                                                                                                  | DONE (2026-09-25: inventory empty, not deleted — the array is kept so a regression is fixed at source rather than re-tolerated; a 4th warning class (`suspended-resource`) added to the guard; #1185 closed; learnings recorded in `agents-docs/LEARNINGS.md` §Core Pitfalls. Every test file and the guard itself now fail on any tracked React warning.) |

## Why the sensor is file-level, not a count baseline

The plan originally called for a numeric baseline. Measurement killed that idea:
one revision reported **13**, **34** and **82** `act(...)` warnings depending on
run shape (single file vs full suite) and reporter (custom vs verbose) — the
count depends on how much async work lands after a test body under load, so a
numeric baseline would flake. _Which files_ warn is stable, so the guard keys on
file identity: 11 inventoried files were tolerated at Phase 2, and Phase 3
drained all of them, so the inventory is now **empty** and every tracked React
warning fails its own test file.

## Phase 3 evidence

### Tranche 1 — the three largest files

All three files emit zero tracked warnings individually, together, and under full
suite load, and each is off `KNOWN_WARNING_FILES`. No component was mocked away
and no `console.error` was stubbed.

| File                      | What the warnings actually were                                                                                            | Fix                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ReaderPage.test.tsx`     | 82 — the reader's async file-url fetch and `useReaderDataLoader` annotation load settled after each test body              | kept the async `renderReaderPage` / `clickAndSettle` / `renderReaderApp` boundaries, so the render and every panel/theme interaction is awaited inside `act`; the A6 offline-restoration render is awaited the same way                                                                                                                       |
| `useReaderSearch.test.ts` | 8 — the debounce-advancing timers and the search promise resolving after assertions                                        | debounce advancement moved inside `await act(async …)`, and the six-section `unload` test now releases the first four loads inside `act`, lets the freed workers start sections 5–6, releases those too, then asserts `isSearching === false` **and** all six `unload` calls (it previously asserted only four and left two promises pending) |
| `storage-quota.test.tsx`  | 7 — the clear flow's continuations (`setCleared`, the 3000 ms dismiss timer, the post-clear refresh) landing outside `act` | the clear flow is settled inside async `act`; the in-flight test asserts the clearing state while pending _and_ the cleared state after; the auto-dismiss test keeps its 3000 ms registration + callback-invocation + visible-then-dismissed assertions, with the spy restored in `finally`                                                   |

The `storage-quota` fix also had to repair the test's own mock: `useTranslation`
returned a **new `t` per render**, so `refresh` changed identity every render,
`useEffect([refresh])` re-fired the estimate fetch, and each `setEstimate({…})`
produced a new object → an unbounded refresh loop that `act` could never drain
(two tests hung to the 30 s timeout). A hoisted, stable `translate` breaks the
cycle. Generalisable lesson: **an unstable value returned from a hook mock can
turn a `useEffect([dep])` into an infinite render loop**, which presents as an
`act` hang rather than as a warning.

Tranche 1 verification (2026-09-23, `apps/web`):

- three files together: 42 passed, no `stderr` React `act(...)` / missing-key /
  unknown-prop block;
- each file alone: 17, 11 and 14 passed, all warning-free;
- full suite with the guard active: **136 files / 1402 tests passed**;
- `pnpm typecheck` (root): 7/7 tasks successful;
- guard re-proved non-vacuous on this change: a throwaway file whose
  `setState` lands outside `act` still fails with
  `React warning(s) emitted in …: act=1 …`, so the clean runs above are
  meaningful rather than vacuous. The throwaway file was deleted afterwards.

Not touched: `apps/web/src/__tests__/scratch-act-probe.test.tsx` is untracked
user work and was left exactly as found.

### Tranche 2 — the remaining eight files

| File                             | What the warnings actually were                                                                                                                                            | Fix                                                                                                                                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account-settings-page.test.tsx` | 2 (`AccountSettingsPage`, `MfaSection`) — the sessions + MFA loads landing after a synchronous `render`                                                                    | render settled inside `act`; **and** the same unstable-`t` mock loop as `storage-quota` (`useEffect([loadSessions])` refetching forever) was repaired with a hoisted `translate` — without it the `act` version hung to the 30 s timeout                |
| `admin-recover-page.test.tsx`    | 2 — the verify request's continuation after the loading-state assertions                                                                                                   | the test's in-flight `resolveVerify()` moved inside `act`; the disabled-button assertion is unchanged                                                                                                                                                   |
| `notification-panel.test.tsx`    | 3 — the mount fetch resolving after the dialog assertion                                                                                                                   | render settled inside `act`                                                                                                                                                                                                                             |
| `useTranslation.test.ts`         | 2 — `setLocale` re-rendering, then the effect resetting `loadedLocale` and re-setting it once `ensureLocale` resolves                                                      | both `act(() => setLocale(…))` calls became `await act(async …)`                                                                                                                                                                                        |
| `useSessionExpiry.test.ts`       | 1 — entering the expiring window also fires the auto-refresh, whose rejected `apiRequest` set `error` after the test body                                                  | the test now mocks a _successful_ refresh and awaits its settlement inside `act` (matching the working sibling test), then asserts a settled non-expiring state. Mocking a failure here would pin an unrelated `error` transition as expected behaviour |
| `SwUpdateNotification.test.tsx`  | 1 — the exit animation's 200 ms unmount, plus a **second** warning from the test's own `finally` calling `useSwUpdateStore.setState` while the component was still mounted | render settled inside `act`; the 200 ms timer awaited inside `act` (asserting the banner is then gone and `dismiss` ran); the store restore moved inside `act`                                                                                          |
| `ReaderToolbar.test.tsx`         | 4 (`Tooltip`) — `Tooltip`'s mount effect `setSupportsNative(...)` after opening the overflow menu                                                                          | render, menu-open click and each keydown wrapped in `act`; see the rAF note below                                                                                                                                                                       |
| `AuditLogPage.test.tsx`          | 1 — a _fourth_ warning class the guard did not represent (see below)                                                                                                       | the one test using a bare synchronous `render` switched to the file's existing `renderAndFlush()` helper                                                                                                                                                |

**A fourth warning class, and a blind spot in the sensor.** `AuditLogPage`'s
warning reads _"A suspended resource finished loading inside a test, but the
event was not wrapped in act(...)."_ — the `act` pattern matched it, so it was
still counted, but the dedicated `use()`/Suspense class had no `ReactWarningKind`
of its own. `suspended-resource` is now tracked explicitly. Because its text also
contains "not wrapped in act(", the pattern list is **ordered**
most-specific-first; the previous first-match order classified it as plain `act`.
This is exactly the blind spot an inventory-only ratchet cannot show you: the
entry looked already-drained while the file was still warning.

**A latent rAF race the warnings were masking.** `ReaderToolbar` autofocuses the
overflow menu's first item inside a `requestAnimationFrame` after opening. The
old tests captured `menuitem` nodes _before_ that frame ran and never awaited
it, so `handleMenuKeyDown` measured `idx === -1` and moved focus to the wrong
item — while still passing, because the autofocused item happened to sit exactly
where the off-by-one index pointed. Draining the act scope exposed it: `ArrowUp`
and `End` failed ~1 run in 3, flipping focus to index 0. The helper now awaits a
real animation frame after opening, and the assertions run against nodes
re-queried from the live menu. Five consecutive clean runs confirm the race is
gone. (A probe test that rendered the toolbar with its own `mockProps` passed in
isolation, which is why the interference had to be traced inside the real file.)

Tranche 2 verification (2026-09-25, `apps/web`):

- all eleven drained files plus the guard's own unit test, in one run: **12
  files / 176 tests passed**, and `grep` for any of the four tracked warning
  strings over the verbose output returns **0**;
- full suite with the (now empty) inventory: **136 files / 1403 tests passed**;
- `pnpm typecheck` (root): 7/7 tasks successful. It caught
  `Promise.withResolvers` being unavailable in `apps/web` (ES2022 lib) —
  replaced with the `new Promise` form the repo already documents in
  `src/lib/api/core.test.ts`;
- the guard's non-vacuity was re-established on the empty inventory: the four
  `classifyReactWarning` classes and the `suspended-resource` failure path are
  unit-tested, and the Phase-2 negative control (a throwaway file leaking a
  `setState` outside `act`) still fails the file it lands in.

## Acceptance

- Phase 1 is verifiable today: `cd apps/web && pnpm exec vitest run <file>
--reporter=verbose --silent=false` prints no `stderr` block for the touched files.
- Phase 2 is verifiable today: deleting an entry from `KNOWN_WARNING_FILES`
  fails that file with an actionable message (checked for
  `src/hooks/useSessionExpiry.test.ts`, exit 1); a warning whose file cannot be
  attributed fails as `<unknown file>`; and the guard never suppresses output —
  every `console.error` call is forwarded to the original.
- Phase 3 must not weaken assertions to silence a warning (no `act` wrapping of
  an assertion that no longer asserts, no `console.error` stubs). All eleven
  files satisfy this: each keeps its assertions, three of them _strengthen_
  them (six `unload` calls instead of four; clearing-then-cleared states in the
  in-flight quota test; a post-dismiss unmount assertion in the SW-update
  test), and no component or console API is stubbed anywhere.
- Phase 3 is met: `KNOWN_WARNING_FILES` is empty and the full suite is green
  under it. Phase 4 remains — record the learnings, then #1185 may close.

## Related

- #1175 — the three warning classes fixed here.
- #1185 — tracking issue for the remaining inventory.
- GOAP-241 — earlier warning-closure plan (same "warnings are defects" stance).
- `agents-docs/LEARNINGS.md` — the default-reporter silence is captured there.
