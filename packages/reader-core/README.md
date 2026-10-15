# @do-epub-studio/reader-core

EPUB reader engine adapter. Abstracts EPUB parsing, locator management, and annotation reanchoring behind a clean API. Built on `@intity/epub-js`.

## Modules

| File             | Purpose                                                               |
| ---------------- | --------------------------------------------------------------------- |
| `epub-loader.ts` | Load and initialize EPUB documents                                    |
| `epub-types.ts`  | TypeScript types for EPUB structure (spine, TOC, metadata)            |
| `locator.ts`     | `LocatorResult` type (cfi + textExcerpt + chapterHref), serialization |
| `toc.ts`         | Table of contents parsing and navigation                              |
| `reanchor.ts`    | Multi-signal annotation reanchoring per ADR-006                       |

## Locator System (ADR-006)

Annotations use a triple-signal locator: **CFI** (structural), **text excerpt** (content-based), **chapter HREF** (context). Reanchoring does not trust the saved CFI because it may point to different content after an EPUB revision. `reanchor.ts` runs text-position, exact/partial quote, then fuzzy word-overlap strategies. Accepted position updates discard the stale CFI. Quote prefix/suffix context disambiguates repeated exact quotes; an ambiguous repeated quote without matching context is not accepted as an exact match. Results report a `matchType` of `'exact' | 'fuzzy' | 'partial'` and a `fallback` boolean.

## Scripts

| Command          | Description                          |
| ---------------- | ------------------------------------ |
| `pnpm typecheck` | `tsc --noEmit`                       |
| `pnpm lint`      | ESLint                               |
| `pnpm bench`     | Vitest benchmarks (reanchoring perf) |

## Re-anchoring benchmark

Run the focused gate with `pnpm --filter @do-epub-studio/reader-core exec vitest run src/__tests__/reanchor-benchmark.test.ts`. It creates a deterministic ASCII chapter of at least 45,000 characters from 300 paragraphs and reanchors 100 exact quote anchors sequentially; the test fails above 50 ms. This measures the in-process matching path, not EPUB parsing, worker startup, or migration I/O.

CI runs on GitHub-hosted `ubuntu-latest` standard x64 runners (4 CPU cores, 16 GB RAM) with Node.js 24. These are runner-label specifications, not a fixed CPU model; hosted hardware can vary. Sources: [GitHub-hosted runner specifications](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) and `.github/actions/setup-pnpm/action.yml`.
