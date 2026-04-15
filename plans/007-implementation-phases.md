# 007 – Implementation Phases

## Phase 0 – Foundation (COMPLETE)

- Repo + pnpm/turbo workspace bootstrapped.
- Skills installed; TRIZ analysis/resolution recorded.
- ADRs 002–006 accepted.

## Phase 1 – Schema + Access Spine (COMPLETE)

**Scope:** finalize migrations, DTOs, access endpoints, audit logging.

| Task                             | Output                                             | Owner Notes           |
| -------------------------------- | -------------------------------------------------- | --------------------- | ------------------------------------- | ---------------- |
| `packages/schema` migration pass | `0001-initial-schema.sql` mirrored to Turso        | Align with ADR-003    |
| DTOs + validation                | `packages/shared` exports for grants/sessions      | Reuse in worker + web |
| Access APIs                      | `/api/access/request                               | refresh               | logout` hardened with logging + trace | enforce Argon2id |
| Signed URLs                      | `storage/signed-url.ts` w/ TTL + checksum          | Adds trace logs       |
| Audit trail                      | `apps/worker/src/audit` invoked on grants/sessions | include traceId       |

**Exit criteria:**

- Reader authenticates via UI + Worker.
- Short-lived session + signed EPUB URL returned.
- Audit log entry stored for grant usage.

## Phase 2 – Reader MVP (COMPLETE)

- EPUB.js integration + TOC.
- Theme/typography controls persisted.
- Progress roundtrip via Worker.

**PR:** #11 - merged to main

## Phase 3 – Offline & Sync (COMPLETE)

- Service worker (src/sw.ts) with injectManifest strategy: cache-first for shell/assets/fonts/images, network-first for API, cache-first for EPUB files.
- IndexedDB schema (lib/offline/db.ts) for progress, annotations, sync queue, permission cache.
- Permission cache TTL (24h) + zombie detection with periodic validation (lib/offline/permissions.ts).
- Sync queue with exponential backoff, max 5 retries, permission revocation detection (lib/offline/sync.ts).
- Reader progress locally first, queued sync on reconnect with online/offline listeners.
- PWA manifest icons generated (192x192, 512x512).
- Comprehensive test coverage: offline-db.test.ts, offline-sync.test.ts, offline-permissions.test.ts.
- Permission revocation callback integration for UI notifications.

**PR:** Ready for review

## Phase 4 – Editorial Toolkit (COMPLETE)

- Highlights + comments UI with threaded replies, resolve/unresolve, edit, delete.
- Visual highlight overlays rendered on EPUB text via `rendition.annotations.highlight()`.
- Visual comment markers (underlines) rendered on EPUB text via `rendition.annotations.add('underline')`.
- Re-anchoring heuristics per ADR-006 wired into annotation render flow.
- Bookmark creation, listing, navigation, and deletion UI.
- CommentInput component wired into annotation flow with auto-focus.
- Export notes as Markdown (highlights + comments).
- Offline sync queue fixed to distinguish highlights vs comments.
- Background sync tag `sync-reader-state` registered on app load.

## Phase 5 – Admin Console (COMPLETE)

- Book catalog + upload flow with presigned R2 upload.
- Grant editor with capability toggles, expiry, create/edit/revoke.
- Audit log UI with filtering (entity type, date range, entity ID) + CSV export.
- Admin login page with role-based route guards (`AdminRoute`).
- Admin navigation bar linking Books, Grants, and Audit Log pages.

## Phase 6 – Hardening & Release (COMPLETE)

- **Security headers**: Added comprehensive security headers to all Worker responses:
  - `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`
  - `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`
  - Minimal security headers for file downloads (omits CSP to avoid interference)
  - New module: `apps/worker/src/lib/security-headers.ts` with full test coverage
- **Test coverage**: Installed `@vitest/coverage-v8` across all packages with coverage thresholds:
  - `apps/web`: 10% lines, 55% functions (UI components need more unit tests)
  - `apps/worker`: 55% lines, 65% functions
  - `packages/shared`: 45% lines, 80% on schemas
  - `packages/reader-core`: 30% lines, 60% functions
  - Added `pnpm test:coverage` script
- **E2E test expansion**: Added comprehensive test suite (`reader-annotations-and-admin.spec.ts`):
  - Reader annotation flows (highlights, comments, bookmarks, export)
  - Admin console flows (login, books, grants, audit log, route guards)
  - Accessibility tests (label associations, button names, locale switcher, error announcements)
  - i18n tests (locale switching, persistence)
  - Offline behavior tests
- **Accessibility audit**: Added axe-core integration (`accessibility-audit.spec.ts`):
  - Tests login page, reader page, and admin login page for WCAG 2.1 AA violations
  - Zero critical/serious violations required
- **Accessibility improvements**:
  - Created `useFocusTrap` hook for modal/sidebar focus management
  - Updated Modal component with focus trap, focus restoration, and `aria-describedby` support
  - Added `LiveRegion` component for screen reader announcements
  - Updated Spinner with `role="status"` and `sr-only` label
  - Fixed hover-only action buttons in CommentsPanel — now visible on focus too
  - Added keyboard navigation to annotation navigation elements (Enter/Space activation)
- **i18n parity test**: Added automated test to verify:
  - All locales have the same keys
  - No empty or placeholder translations
  - No untranslated keys
- **Performance & bundle analysis**:
  - Added `rollup-plugin-visualizer` for bundle size analysis
  - Configured manual code splitting (react-vendor, epubjs, zustand, workbox)
  - Added `build:analyze` script generating `dist/stats.html` with gzip/brotli sizes
- **CODEOWNERS**: Created `.github/CODEOWNERS` with path-based ownership for all code areas

**Quality gate status:**

- `pnpm lint`: ✅ 0 errors
- `pnpm typecheck`: ✅ All 7 packages pass
- `pnpm test`: ✅ 46 passed + 2 skipped (5 test files)
- `pnpm build`: ✅ Production build succeeds

**Remaining gaps (future iterations):**

- More unit tests for UI components (currently at 10% statement coverage in web app)
- E2E tests running on Firefox/WebKit (currently Chromium only)
- Automated changelog generation and semantic versioning
- Staging environment deployment pipeline
- Post-deploy smoke tests

## Tracking Rules

- Update this file at the end of each phase with actual outcomes + links to PRs.
- Link back to GOAP roadmap (`plans/001-goap-roadmap.md`).
- Include traceability to TRIZ contradictions when defining new workstreams.

## Phase 7 – Test Coverage & CI Improvements (PARTIAL COMPLETE)

**Scope:** Increase test coverage, cross-browser E2E, CI/CD enhancements.

| Task                                            | Status          | Coverage                                        |
| ----------------------------------------------- | --------------- | ----------------------------------------------- |
| reader-core unit tests (locator, reanchor, toc) | ✅ complete     | 83% (target 60%)                                |
| API client tests                                | ✅ complete     | 100% on api.ts                                  |
| Cross-browser Playwright (Firefox/WebKit)       | ✅ config added | Chromium/Firefox pass, WebKit needs system deps |
| annotation component tests                      | pending         | 0%                                              |
| admin page UI tests                             | pending         | 0%                                              |

**Achievements:**

- reader-core coverage: 33% → 83% (locator.ts, toc.ts: 100%, reanchor.ts: 83%)
- API client coverage: 0% → 100% on api.ts
- Added Firefox/WebKit to Playwright config with webServer auto-start
- Added 19 API client tests (error handling, trace headers, locale, abort)
- Added 78 reader-core tests (locator, toc, reanchor)
- Added `do-web-doc-resolver` skill to fetch external documentation as markdown for agents

**Remaining gaps:**

- Annotation component tests (AnnotationToolbar, CommentInput, CommentsPanel)
- Admin page UI tests (AdminLoginPage, AuditLogPage, BooksPage, GrantsPage)

**Quality gate status:**

- `pnpm lint`: ✅ 0 errors
- `pnpm typecheck`: ✅ All packages pass
- `pnpm test`: ✅ 145 tests passed (4 test files in reader-core, 6 in web)

## Phase 8 – Quality, Benchmarking, and Agent Workflow Hardening (PLANNED)

**Scope:** close remaining quality gaps from Phase 7 and align test tooling/docs with 2026 reliability practices.

| Task                                                                              | Status         | Deliverable                                                                |
| --------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------- |
| Playwright reliability baseline (`baseURL`, artifacts, deterministic `webServer`) | ✅ complete    | Updated `playwright.config.ts` with CI/local tuned defaults                |
| Optional WebKit execution gate for Linux/WSL runners                              | ✅ complete    | `PLAYWRIGHT_INCLUDE_WEBKIT=1` opt-in to avoid false negatives              |
| Coverage gap backlog triage (annotations + admin pages)                           | 🚧 in progress | Backlog captured in `plans/010-optimization-quality-backlog.md`            |
| Benchmark harness for reader-core hot paths                                       | 🚧 in progress | Documented as priority task in `plans/010-optimization-quality-backlog.md` |
| Agent workflow refresh (review cadence + done criteria)                           | ✅ complete    | Added 2026 checklist updates in `docs/coding-guide.md` and plan backlog    |

**Exit criteria:**

- E2E defaults are deterministic in local + CI runs.
- Remaining missing tasks are documented with priorities and measurable acceptance criteria.
- Quality gate remains green after config/doc updates.
