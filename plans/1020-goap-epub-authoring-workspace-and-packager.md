# GOAP-1020: Build Structured EPUB Authoring Workspace and EPUB 3 Export Pipeline

**Status:** IN PROGRESS
**Date:** 2026-11-05
**Issues:** #1431
**Decision:** [ADR-1020](1020-adr-epub-authoring-and-packager.md)
**Design:** [System design](003-system-design.md#goap-1020--structured-epub-authoring-workspace-and-epub-3-export-pipeline)
**TRIZ analysis:** [analysis/triz-core-2026-11-05.md](../analysis/triz-core-2026-11-05.md)

## Goal

Implement a focused authoring workspace and deterministic EPUB 3 packaging pipeline that allows users with authoring permission to compose publications from scratch or template, manage structured chapters, preview through the production reading engine, and publish as immutable EPUB 3 revisions.

## Baseline

- `main` is current at commit `afedbd7f` following the merge of PR #1442 and closure of #1434.
- Creating a book in `BookCreateModal.tsx` currently mandates an uploaded `.epub` file.
- `apps/worker/src/routes/admin/books.ts` requires prebuilt files and has no manuscript authoring or EPUB generation route.
- `packages/reader-core` provides EPUB parsing, CFI resolution, and DOM sanitization, but has no runtime EPUB 3 packaging/generation library (only test fixture generation in `generate-capabilities.mjs` and `generate.mjs`).
- Database schema supports books, revisions (`book_files`), grants, annotations, and audit logs, but has no mutable draft manuscript table.

## Acceptance and evidence

| Criterion                     | Required outcome                                                                                                                                                                                 | Evidence to record                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| C1: Manuscript authoring      | Users with authoring permission can create a publication from a template or blank manuscript without an external EPUB. Manage chapters (create, rename, reorder, delete, edit semantic content). | Schema validation tests, authoring route tests, web authoring UI components.                      |
| C2: Deterministic packager    | `packageEpub3()` compiles structured manuscript into a valid EPUB 3 archive (uncompressed mimetype, container.xml, content.opf, nav.xhtml, XHTML chapters, assets).                              | Unit tests in `packages/reader-core` testing package structure, XML validity, and EPUBCheck pass. |
| C3: Draft lifecycle & safety  | Drafts save with optimistic version locking (`draft_version`). Concurrent conflicting saves return 409 Conflict. Autosaves never overwrite published revisions.                                  | Concurrency tests in worker unit tests, API tests.                                                |
| C4: Production reader preview | Draft chapters render in preview tab using `ReaderViewer` and production typography settings with zero keystroke lag.                                                                            | Web component tests and visual fidelity check.                                                    |
| C5: Publishing pipeline       | Explicit publish compiles the EPUB, validates archive safety, stores in R2, creates a new immutable `book_files` revision row, and enqueues EPUBCheck validation.                                | Integration tests verifying new immutable revision created and previous revisions intact.         |
| C6: Role-based access control | Explicit `author` role and `/api/author/*` route guard. Admin access allowed; reader/commentator access forbidden.                                                                               | Route authorization tests.                                                                        |
| C7: Cross-browser E2E         | Browser E2E spec exercises authoring manuscript creation, editing, previewing, and publishing.                                                                                                   | Playwright E2E test passing on Chromium and WebKit.                                               |

## Execution slices

1. **Architecture & Design (Slice 1)**: ADR-1020, System design, TRIZ analysis, and this plan.
2. **Schema & Migration (Slice 2)**: Add `book_manuscript_drafts` table migration and shared Zod schemas (`AuthorPublicationSchema`, `ChapterDraftSchema`, `SaveManuscriptSchema`).
3. **EPUB 3 Packager in `reader-core` (Slice 3)**: Implement deterministic, streaming `packageEpub3()` with XML escaping, standard manifest/spine generation, navigation document, and ZIP packaging.
4. **Author API in `apps/worker` (Slice 4)**: Implement `/api/author/books/:id/manuscript` (GET/PUT with optimistic concurrency) and `/api/author/books/:id/publish` (compile, safety check, R2 upload, revision row, EPUBCheck enqueue).
5. **Authoring Workspace UI in `apps/web` (Slice 5)**: Add authoring workspace with metadata editing, chapter tree/reordering, semantic rich editor, reader preview tab, and publish action. Add "Create from scratch" option in book creation.
6. **Testing & Verification (Slice 6)**: Unit tests for packager, worker route tests, component tests, Playwright E2E test, and monorepo quality gate.

## Non-negotiable boundaries

- Published book revisions are immutable. Draft autosaves operate exclusively on `book_manuscript_drafts` and never overwrite R2 objects.
- Active content, `<script>`, and inline `on*` event handlers are strictly forbidden in manuscript content and sanitized with `DOMPurify`.
- Memory limits: packaging must stream entries sequentially without buffering unbounded publication content in memory.
- Authorization: authoring permissions are strictly separated from read-only reader tokens and feedback comments.
