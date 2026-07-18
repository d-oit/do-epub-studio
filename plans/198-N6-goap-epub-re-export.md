# Plan 198-N6: GOAP — EPUB Re-Export / Packager

**Status:** 📋 PROPOSED
**Date:** 2026-07-18
**Decision:** ADR-198 (Verified-Closure Methodology)
**Priority:** P3
**Source:** Plan 121 (N6), Plan 120 (Cluster 11)
**Ships as:** `feat/epub-re-export-packager`

## Goal

Allow users to export their annotations, highlights, and bookmarks as a new
EPUB file that embeds the annotations inline, or as a standalone document
(Markdown/HTML) containing all notes with chapter context.

## Context

The `useExportNotes` hook already exports notes as Markdown. This plan extends
that to support EPUB re-export (embedding annotations into a copy of the
original EPUB) and improves the export format with chapter navigation.

## Decompose

| ID | Task | Effort | Deps |
|----|------|--------|------|
| T1 | Design EPUB annotation injection format (CFI-based insertion points) | M | — |
| T2 | Implement EPUB copy + annotation injection pipeline | L | T1 |
| T3 | Add `POST /api/books/:id/export` endpoint | M | T2 |
| T4 | Create client-side export dialog (format selection: EPUB, Markdown, HTML) | M | T3 |
| T5 | Add tests for export round-trip | M | T4 |

## Risks

- **EPUB validity:** Injecting annotations may break EPUB validation
- **Large exports:** Books with many annotations may produce large files
- **CFI accuracy:** Annotation positions may shift after injection

## Acceptance Criteria

- [ ] Users can export a book with annotations as EPUB, Markdown, or HTML
- [ ] Exported EPUB passes `epubcheck` validation
- [ ] Annotations appear inline at their CFI positions
- [ ] Export endpoint has proper auth and rate limiting
- [ ] Tests cover all three export formats
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` pass
