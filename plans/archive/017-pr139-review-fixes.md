# Plan 017: PR #139 Review Fixes - reanchorByText Performance Optimizations

**Goal:** Address all Codacy review comments on PR #139, ensuring merge readiness with passing CI and resolved inline discussions.

## Changes Made

### `packages/reader-core/src/reanchor.ts` (4 fixes)

| # | Line | Issue | Fix |
|---|------|-------|-----|
| 1 | 21 | `/[^\w\s]/g` strips non-ASCII chars (breaks i18n) | Replaced with `/[^\p{L}\p{N}\s]/gu` for Unicode property escape support |
| 2 | 90-108 | `uniqueHrefs` built from base-stripped hrefs -> `chapterHref` result loses fragment | Changed from `Set<string>` of base paths to `Map<base, firstHref>`. Result now preserves original TOC href with fragment. Caching still deduplicates by base path. |
| 3 | 62-65, 151-157 | `wordSet` persisted in `CachedChapter` -> memory leak for large books | Removed `wordSet?` from `CachedChapter` interface. `wordSet` is now a local `const` in Pass 2, garbage-collected after each chapter. |
| 4 | 166 | `fuzzyThreshold` option ignored (hardcoded 0.7) | Now uses `const threshold = options.fuzzyThreshold ?? 0.7` |

### `packages/reader-core/src/reader-core.bench.ts` (1 fix)

| # | Issue | Fix |
|---|-------|-----|
| 5 | Codacy/Biome flags arrow functions as Qwik serialization violations | Refactored `mockLoadContent` from const-arrow to function declaration. Renamed stress test constants to `UPPER_CASE` for code quality. |

## Status: ✅ COMPLETED

| Check | Status | Detail |
|-------|--------|--------|
| Lint | ✅ | All 7 packages pass |
| Typecheck | ✅ | All 7 packages pass |
| Unit tests (reanchor) | ✅ | 22/22 pass |
| Unit tests (reader-core) | ✅ | 39/39 pass (across reanchor + locator) |
| Coverage | ✅ | Thresholds met |
| Build | ✅ | All packages build |
| E2E Smoke | ✅ | Chromium + Firefox pass |
| Production E2E Smoke | ✅ | Pass |
| Codacy Static Analysis | ✅ | Pass |
| Push to remote | ✅ | `9746fc3` pushed to `perf-reader-reanchor-opt-9426957081276186440` |

## Pre-existing (not addressed)

- `epub-loader.test.ts` — 1 test fails (metadata.title empty vs 'Test Book'), unrelated to reanchor changes
