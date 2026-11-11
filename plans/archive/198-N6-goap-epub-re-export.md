# Plan 198-N6: GOAP — EPUB Re-Export / Packager

**Status:** ✅ COMPLETED (Issue #1432 verified 2026-11-11 — EPUB appendix re-export implemented; see the revised acceptance contract below)
**Completion note:** Plan 199 covered only Markdown/HTML. Issue #1432 added EPUB re-export with a navigable annotations appendix, safe links to resolvable source CFIs, and explicit stale/unresolved markers. Annotations are not injected into source chapter XHTML; the old “inline at CFI” wording is superseded by the link-and-appendix contract below.

**Date:** 2026-07-18
**Decision:** ADR-198 (Verified-Closure Methodology)
**Priority:** P3
**Source:** Plan 121 (N6), Plan 120 (Cluster 11)
**Ships as:** `feat/epub-re-export-packager`

## Goal

Allow users to export their annotations, highlights, and bookmarks as a new EPUB copy with a navigable appendix and links back to source locations, or as a standalone Markdown/HTML document containing all notes with chapter context.

## Context

The `useExportNotes` hook already exports notes as Markdown. This plan extends that to add a navigable annotation appendix to a copy of the original EPUB, with safe links to resolvable CFI/chapter locations and explicit markers for stale or unresolved annotations.

## Decompose

| ID  | Task                                                                      | Effort | Deps |
| --- | ------------------------------------------------------------------------- | ------ | ---- |
| T1  | Define safe appendix representation and CFI source-link rules             | M      | —    |
| T2  | Implement EPUB copy + navigable annotation appendix pipeline              | L      | T1   |
| T3  | Extend the authorized export route to serve EPUB bytes                    | M      | T2   |
| T4  | Create client-side export dialog (format selection: EPUB, Markdown, HTML) | M      | T3   |
| T5  | Add tests for export round-trip                                           | M      | T4   |

## Risks

- **EPUB validity:** Adding appendix content and updating navigation may break EPUB validation
- **Large exports:** Books with many annotations may produce large files
- **CFI safety:** Only create source links when locators resolve unambiguously; retain stale or unresolved records in the marked appendix.

## Acceptance Criteria

- [x] Users can export a book with annotations as EPUB, Markdown, or HTML
- [x] Exported EPUB passes `epubcheck` validation
- [x] Resolvable annotations link back to their source CFI/chapter; stale or unresolved annotations remain in the navigable appendix with explicit markers and available context
- [x] Export endpoint has proper auth and rate limiting
- [x] Tests cover all three export formats
- [x] Focused export unit/route/schema/UI/reader E2E tests pass; `pnpm lint` and `pnpm typecheck` pass. (Full `pnpm test:unit` was not run.)
