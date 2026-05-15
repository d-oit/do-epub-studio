# @do-epub-studio/reader-core

EPUB reader engine adapter. Abstracts EPUB parsing, locator management, and annotation reanchoring behind a clean API. Built on `@intity/epub-js`.

## Modules

| File | Purpose |
|------|---------|
| `epub-loader.ts` | Load and initialize EPUB documents |
| `epub-types.ts` | TypeScript types for EPUB structure (spine, TOC, metadata) |
| `locator.ts` | `LocatorResult` type (cfi + textExcerpt + chapterHref), serialization |
| `toc.ts` | Table of contents parsing and navigation |
| `reanchor.ts` | Multi-signal annotation reanchoring per ADR-006 |

## Locator System (ADR-006)

Annotations use a triple-signal locator: **CFI** (structural), **text excerpt** (content-based), **chapter HREF** (context). The `reanchor.ts` module attempts reanchoring in order: exact match (CFI) -> fuzzy text match (normalized excerpt) -> partial text match (substring). Each result reports a `matchType` of `'exact' | 'fuzzy' | 'partial'` and a `fallback` boolean.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm bench` | Vitest benchmarks (reanchoring perf) |
