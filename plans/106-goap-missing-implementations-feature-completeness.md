# GOAP 106 — Missing Implementations & Feature Completeness

**Date:** 2026-06-23
**Status:** OPEN
**Execution tracker:** consolidated & re-verified in `plans/110-goap-missing-impl-modern-ui-2026-06-24.md`
**Author:** Codebase analysis session
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Related ADR:** `plans/106-adr-feature-completeness-policy.md`
**Extends:** Plan 088 (missing implementation analysis), ADR-077 (phased delivery), ADR-092 (feature-gap policy)

## Goal

Close the remaining feature gaps that prevent the platform from being
a complete, self-service EPUB reading experience. Focus on features
that are referenced in code/routes but not fully wired, and critical
user flows that are absent.

## Analysis — Feature Gap Inventory

### A. Backend: Stub/Incomplete Routes

| Route | File | Status | Gap |
|-------|------|--------|-----|
| `POST /api/admin/auth/recovery` | `routes/admin/auth.ts` | Partial | Magic-link email transport not wired (ADR-081a) |
| `DELETE /api/books/:id` | `routes/books.ts` | Exists | No cascade delete for R2 files + annotations |
| `GET /api/catalog` | `routes/catalog.ts` | Minimal | No pagination, no filtering, no search |
| `POST /api/files/upload` | `routes/files.ts` | Exists | No progress reporting, no chunk upload for large EPUBs |

### B. Backend: Missing Endpoints

| Endpoint | Purpose | Priority |
|----------|---------|----------|
| `GET /api/books/:id/export-notes` | Export annotations/highlights as markdown/JSON | P1 |
| `POST /api/books/:id/search` | Server-side full-text search for large EPUBs | P2 |
| `GET /api/admin/stats` | Dashboard statistics (total books, active users, storage) | P2 |
| `PATCH /api/admin/books/:id` | Edit book metadata (title, author, cover) | P1 |
| `GET /api/reader/:bookId/reading-insights` | Reading speed, time-per-chapter, streaks | P2 (client has `reading-insights.ts`) |

### C. Frontend: Missing User Flows

| Flow | Components Exist? | Gap |
|------|-------------------|-----|
| **Export annotations** | No | No UI to export highlights/notes to file |
| **Book delete with confirmation** | BooksPage has list | No delete confirmation dialog |
| **Catalog search/filter** | CatalogPage is minimal | No search input, no genre/author filter |
| **User settings page** | ReaderSettingsPanel exists | No persistent user profile/preferences page |
| **Reading insights dashboard** | `reading-insights.ts` in lib | No UI component to display insights |
| **Multi-book progress overview** | Reader store tracks per-book | No "My Library" view with progress bars |

### D. Packages: Missing Functionality

| Package | Gap | Impact |
|---------|-----|--------|
| `reader-core` | No text extraction API for full-text search | Search relies on client-side spine iteration |
| `reader-core` | No EPUB export/packager | Cannot re-export annotated EPUBs |
| `shared` | No pagination DTO/schema | Catalog and audit endpoints lack standard pagination |
| `schema` | No `reading_sessions` table schema | Reading insights has no persistence layer |
| `ui` | No `Pagination` component | Admin pages and catalog need it |
| `ui` | No `ConfirmDialog` component | Delete operations need confirmation |
| `ui` | No `SearchInput` component | Catalog, admin, reader all need search UI |
| `ui` | No `ProgressBar` component | Library view, upload progress |
| `ui` | No `Tabs` component | Admin pages, reader side-panel switching |

### E. Offline/PWA Gaps

| Gap | Impact |
|-----|--------|
| No background sync for annotation queue | Annotations created offline may not sync reliably |
| No cache invalidation strategy for book content | Stale chapters after re-upload |
| No storage quota management UI | User can't see/manage offline storage |

## Decomposed Tasks (Priority Order)

### Phase 1 — UI Component Library (1-2 sessions)

1. Add `Pagination` component to `packages/ui`
2. Add `ConfirmDialog` component to `packages/ui`
3. Add `SearchInput` component to `packages/ui`
4. Add `ProgressBar` component to `packages/ui`
5. Add `Tabs` component to `packages/ui`
6. Add Storybook stories for each

### Phase 2 — Catalog & Library (2 sessions)

7. Add `PaginationDto` schema to `packages/shared`
8. Implement catalog pagination + search on backend (`routes/catalog.ts`)
9. Build CatalogPage search/filter UI with container queries
10. Build "My Library" progress overview page

### Phase 3 — Admin CRUD Completeness (1-2 sessions)

11. Implement `PATCH /api/admin/books/:id` for metadata editing
12. Implement cascade delete (R2 + annotations + bookmarks)
13. Add `ConfirmDialog` to BooksPage delete flow
14. Add `GET /api/admin/stats` endpoint
15. Build admin dashboard stats card

### Phase 4 — Export & Insights (2 sessions)

16. Add `GET /api/books/:id/export-notes` endpoint
17. Build export annotations UI (download as markdown)
18. Add `reading_sessions` migration to `packages/schema`
19. Wire reading insights API endpoint
20. Build reading insights dashboard component

### Phase 5 — Offline Resilience (1 session)

21. Implement Background Sync API for annotation queue
22. Add cache invalidation on book re-upload (version header)
23. Add storage quota display in settings

## Dependencies

- Phase 1 is dependency-free
- Phase 2 depends on Phase 1 (Pagination, SearchInput)
- Phase 3 depends on Phase 1 (ConfirmDialog)
- Phase 4 depends on schema migration (Phase 4.18)
- Phase 5 is independent

## Success Criteria

- [ ] `packages/ui` exports Pagination, ConfirmDialog, SearchInput, ProgressBar, Tabs
- [ ] Catalog has working search + pagination
- [ ] Admin book delete shows confirmation and cascades
- [ ] Export annotations produces downloadable markdown
- [ ] All new endpoints have Vitest coverage ≥ 80%
- [ ] All new UI components have Storybook stories
