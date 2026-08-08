# Plan 198-N3: GOAP — Server-Side Full-Text EPUB Search

**Status:** ✅ COMPLETED (Plan 199 verified 2026-07-18 — FTS5 search implemented)
**Date:** 2026-07-18
**Decision:** ADR-198 (Verified-Closure Methodology)
**Priority:** P3
**Source:** Plan 121 (N3), Plan 120 (Cluster 10)
**Ships as:** `feat/server-side-epub-search`

## Goal

Implement server-side full-text search across EPUB content for books where
the user has read access. This enables searching within a book's text content
beyond what the client-side reader can provide (e.g., searching across chapters
without loading the full EPUB).

## Context

Currently, EPUB text search is client-side only (within the loaded chapter).
For large EPUBs or users who want to find content across chapters, a server-side
search index would be significantly more useful.

## Decompose

| ID | Task | Effort | Deps |
|----|------|--------|------|
| T1 | Design search index schema (D1 table or FTS5 virtual table) | M | — |
| T2 | Add EPUB text extraction pipeline (on upload, extract and index text) | L | T1 |
| T3 | Create `GET /api/books/:id/search?q=` endpoint | M | T2 |
| T4 | Create client-side search integration (SearchPanel enhancement) | M | T3 |
| T5 | Add i18n keys for search UI states | S | T4 |
| T6 | Add tests (Worker integration + web component) | M | T4 |

## Risks

- **Storage:** FTS5 indexes can be large for big EPUB libraries
- **Privacy:** Search queries may contain sensitive content
- **Performance:** Indexing on upload adds latency to the upload flow

## Out of Scope

- Full-text search across ALL books (only within a single book)
- Search result highlighting in the EPUB renderer
- Search ranking/relevance tuning

## Acceptance Criteria

- [ ] EPUB text is indexed on upload
- [ ] `GET /api/books/:id/search?q=term` returns matching passages with chapter context
- [ ] SearchPanel shows server-side results when available
- [ ] Tests cover indexing, search, and client integration
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` pass
