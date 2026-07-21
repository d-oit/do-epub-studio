# GOAP Plan 077 — Reader Progress + Search Load

**Date:** 2026-06-15
**Orchestrator:** goap-agent
**Source:** `analysis/SWARM_ANALYSIS.md` G19
**Closes:** G19 (initial progress load on reader open is not wired)

## 1. Analysis

- **Primary Goal:** When the reader opens a book, it loads the
  last saved progress (CFI) from the Worker and calls
  `rendition.display(cfi)`.
- **Constraints:** Must not regress the existing offline-first
  path; the load must work even when offline (use IndexedDB as
  fallback).
- **Complexity:** Small.

## 2. Decomposition

1. **API already exists:** `GET /api/books/:bookId/progress`
   at `apps/worker/src/routes/reader/progress.ts:21-46`.
2. **Web:** in `ReaderPage.tsx:130-155`, add a parallel
   `fetchProgress(bookId)` call. If it returns a CFI and the
   offline DB does **not** have a more-recent CFI, call
   `renditionRef.current.display(cfi)`.
3. **Offline fallback:** read `progress` from
   `lib/offline/db.ts` first; only call the API when the
   network is up.
4. **Telemetry:** emit a `progress_loaded` event with the
   source (`server`, `offline`, `default`).
5. **Test:** unit test that asserts the new effect runs the
   API call; integration test via Playwright that opens a
   book, saves progress, reloads, and asserts the CFI matches.

## 3. Strategy

**Sequential.** One PR.

## 4. Quality Gates

- `./scripts/quality_gate.sh`
- New Playwright spec:
  `apps/tests/reader-resume-progress.spec.ts` (extend
  `reader-migration-smoke.spec.ts` rather than create a new
  file).

## 5. Atomic Commits

1. `feat(web): load saved progress on reader open with offline fallback`
2. `test(web+playwright): cover reader resume progress flow`
3. `docs(plans): record execution of plan 077`

## 6. Reference

- `analysis/SWARM_ANALYSIS.md` G19
- `apps/worker/src/routes/reader/progress.ts:21-46`
- `apps/web/src/lib/offline/db.ts` (progress store)
- `docs/offline.md:32` (the promise this PR fulfills)
