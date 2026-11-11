# GOAP-1020: Build Structured EPUB Authoring Workspace and EPUB 3 Export Pipeline

**Status:** COMPLETE
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

| Criterion                     | Required outcome                                                                                                                                                                                 | Evidence to record                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1: Manuscript authoring      | Users with authoring permission can create a publication from a template or blank manuscript without an external EPUB. Manage chapters (create, rename, reorder, delete, edit semantic content). | Schema validation tests, authoring route tests, web authoring UI components.                                                                               |
| C2: Deterministic packager    | `packageEpub3()` compiles structured manuscript into a valid EPUB 3 archive (uncompressed mimetype, container.xml, content.opf, nav.xhtml, XHTML chapters, assets).                              | Reader-core packager tests; generated asset-backed EPUB passed EPUBCheck 5.4.0 with zero errors or warnings.                                               |
| C3: Draft lifecycle & safety  | Drafts save with optimistic version locking (`draft_version`). Concurrent conflicting saves return 409 Conflict. Autosaves never overwrite published revisions.                                  | Concurrency tests in worker unit tests, API tests.                                                                                                         |
| C4: Production reader preview | Explicit full-manuscript preview packages the draft and loads it through `createEpubLoader` with the production reader and sanitizer; the editor does not package on each keystroke.             | Playwright Chromium/WebKit verifies rendered chapter content and a preview frame larger than 200 × 200; live browser screenshot confirmed visible content. |
| C5: Publishing pipeline       | Explicit publish compiles the EPUB, validates archive safety, stores in R2, creates a new immutable `book_files` revision row, and enqueues EPUBCheck validation.                                | Integration tests verifying new immutable revision created and previous revisions intact.                                                                  |
| C6: Role-based access control | Global admins or users with active book-scoped `authoringAllowed` grants may author; read-only grants are denied.                                                                                | Worker authorization and invitation lifecycle tests.                                                                                                       |
| C7: Cross-browser E2E         | Browser E2E spec exercises authoring manuscript creation, editing, previewing, and publishing.                                                                                                   | Playwright E2E passes on Chromium and WebKit; axe scan reports zero violations and chapter creation is keyboard-operated.                                  |

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
- Memory limits: manuscripts are capped at 100 chapters and 500,000 XHTML characters per chapter; author assets are capped at 50 files and 10 MiB per book. ZIP entries are added sequentially and the complete bounded package is retained for archive validation, digesting, and R2 publication.
- Authorization: authoring permissions are strictly separated from read-only reader tokens and feedback comments.

## Verification

- `pnpm verify` passed: lint, validation of all 17 workflows, typecheck, coverage, build, and E2E smoke (60 passed, 12 skipped).
- Schema coverage passed with 19 test files and 215 tests: 99.32% statements, 93.1% branches, 100% functions.
- `pnpm exec prettier --check` passed for the touched plan, authoring, worker, reader-core, and schema files.
- Authoring workspace E2E passed in Chromium and WebKit; preview frame exceeded 200 × 200 and rendered chapter content.
- An asset-backed generated EPUB passed EPUBCheck 5.4.0 with zero errors and warnings.
