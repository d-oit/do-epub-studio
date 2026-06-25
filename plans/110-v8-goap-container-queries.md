# GOAP 110-V8 — Container Queries for Reader Panels, Admin Tables, Catalog Grid

**Date:** 2026-06-25
**Status:** Executing
**ADR basis:** ADR-105 (2026 UI Platform Modernization Policy), ADR-063a (Accessible Design Tokens)
**Parent plan:** `plans/110-goap-missing-impl-modern-ui-2026-06-24.md` (T8 — closes V8)

## Goal

Replace component-level viewport media queries with `@container` + `container-type: inline-size` in:

1. **Reader side-panels** — TOC, SearchPanel, BookmarksPanel, AnnotationToolbar
2. **Reader toolbar** — ReaderToolbar (icons vs. mobile-overflow-menu trigger)
3. **Admin tables** — BooksPage, AuditLogPage
4. **Catalog grid** — CatalogPage book grid

## Strategy

Hybrid (sequential CSS plumbing, parallel component refactor + tests).

- Phase A: Add container utilities + named containers to `globals.css` (1 file).
- Phase B: Per-component edit: parent gets `container-type: inline-size @container-name`, child uses `@container (min-width: 400px)` etc. via Tailwind 4 `@` variants.
- Phase C: Add 2+ Vitest tests asserting container-query-driven class names are present on rendered elements.
- Phase D: Quality gate → commit → PR.

## Naming convention

- `toc-panel`, `search-panel`, `bookmarks-panel`, `annotation-toolbar`, `reader-toolbar`, `catalog-grid`, `admin-books-grid`, `admin-audit-table` — the `--container-name` matches the component role.

## Tailwind 4 @container variant

Tailwind v4 ships `@` syntax out of the box. No plugin required. We use:

```
<div class="@container/toc-panel">  /* named container */
  <button class="@[400px]:inline"> /* container query at 400px */
```

For plain CSS we add a small `@layer components` block with reusable patterns.

## Tests

- `TableOfContents.test.tsx` — assert `aside` has `@container/toc-panel` class and that TOC items have `@[400px]:justify-start` (or similar).
- `AnnotationToolbar.test.tsx` — assert `motion.div` has `@container/annotation-toolbar` class.
- New `BookmarksPanel.test.tsx` case — assert named container class.

(2+ new tests covered.)
