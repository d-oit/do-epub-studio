# GOAP-295: reader spine collection — fix the silently dead search/prefetch paths

**Status:** DONE (implemented + verified 2026-09-30 — live browser search confirmed)
**Date:** 2026-09-30
**Source:** observation recorded in `plans/293-goap-assistance-integration.md` (GOAP-293 browser verification)
**Governance:** none new — a defect fix inside existing reader behavior; no ADR/policy change.

## Problem

Vite resolves `@intity/epub-js`'s ESM source, where the loaded book exposes
`book.sections` — a Map-like `Spine` keyed by href. Both reader consumers read
`book.spine` (the bundled dist build's field, absent here) behind guards:

- `useReaderSearch` (`if (!spine) return;`) — in-book search silently returns
  nothing under the real build.
- `useReaderEpub` prefetch setup (`if (spineLike)`) — `PrefetchManager` never
  receives a spine, so chapter prefetch never runs.

The creator chapter extractor (GOAP-293) already normalizes both shapes after
the same discovery; this slice applies that lesson in one shared place.

## Change

- New `apps/web/src/lib/epub-sections.ts`: `collectSpineSections<T>(book)`
  normalizes `book.sections` (Map `.values()`, iterable) and `book.spine`
  (`.each`) plus plain arrays; returns `[]` when neither exists.
- `useReaderSearch` enumerates via the helper (no behavior change otherwise).
- `useReaderEpub` feeds `PrefetchManager` from the helper.
- `features/creator/lib/book-chapters.ts` drops its local duplicate collector
  and uses the shared helper.
- `features/reader/lib/epub-internals.ts` drops the now-unused `EpubSpine` /
  `EpubBookInternals.spine` typing (search/prefetch no longer reach into it).

## Acceptance

- Real browser: search for a word present in the demo book's chapter text
  returns the match (before the fix: `No matches`).
- Prefetch manager receives the book's spine items for the same loaded book.
- Unit: helper covers Map, `.each`, array, missing; search-hook tests stub the
  real build shape (`sections` Map) and a fallback case keeps the dist shape.
- No reader-core or worker change; `getSpineItems()` remains untouched (unused
  in apps).

## Verification

- `pnpm --filter @do-epub-studio/web exec vitest run src/features/reader src/lib`
  and the creator suite.
- typecheck + eslint + prettier on changed files.
- Live: `pnpm dev` + demo reader, search flow before/after, with screenshots.

## Observed results (2026-09-30)

- **Failing-before proof:** with only `useReaderSearch.ts` reverted (git stash),
  the updated hook tests fail **6/12** — the `sections`-Map books yield no
  results under the old single-field read. Restored: 12/12.
- Affected suites: 42 files / **460 tests pass** (`src/features/reader`,
  `src/lib`, `src/features/creator`); typecheck, eslint, LOC cap clean.
- **Live browser (demo reader, real Worker + local D1):** searching
  `lamplighter` — a word present in Chapter One — now reports **"2 matches"**
  with real excerpts and highlighted hits in both the panel and the rendered
  chapter (screenshot captured). Previously the same panel returned no
  results.
- Prefetch: `PrefetchManager.setSpine` now receives the book's sections from
  the same normalizer (unit-covered via the reader hook suites).
- New helper unit tests cover Map, `.each`, array, Set and missing shapes.
