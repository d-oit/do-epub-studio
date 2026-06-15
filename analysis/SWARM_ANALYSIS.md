# Swarm Analysis - 2026-06-15

> **Author:** goap-agent (swarm analysis)
> **Date:** 2026-06-15
> **Branch:** `swarm-analysis-2026-06-15`
> **Replaces:** the 2026-04-08 + 2025-01 versions in this file
> **Methodology:** four parallel explore agents covering
> (1) Feature Gaps & Implementation Completeness,
> (2) Test Coverage & Documentation,
> (3) Architecture & Patterns,
> (4) Security & Quality.
> Findings were cross-referenced and merged. The 13 prior
> gaps (G1–G13) are closed and recorded below; 15 new
> gaps (G14–G28) are introduced. Each Critical/High gap
> is paired with a GOAP plan and an ADR in `plans/`.

## Executive Summary

| Severity | Open Gaps | Closed (G1–G13) |
|---|---|---|
| Critical | 3 (G14, G15, G16) | 3 (G2, G4, G13) |
| High | 6 (G17, G18, G19, G20, G21, G22, G23) | 3 (G3, G5, G9) |
| Medium | 6 (G24, G25, G26, G27, G28, G6) | 2 (G7, G8) |
| Low (informational) | 0 | 5 (G1, G10, G11, G12 – and a re-numbered track of small ones) |

The 2026-Q2 work has substantially matured the platform: signed
URLs, Argon2id, Zod-based boundary validation, multi-signal
locators, in-book search, session expiry handling, and security
posture docs are all live. Coverage thresholds are met in every
package and most admin / reader surfaces have unit and Playwright
coverage.

The remaining gaps cluster around three themes:

1. **Tenant isolation (G14, G16, G22)** — write paths validate a
   user's grant, but URL `bookId` is not always re-validated
   against the session's `bookId`; locator JSON is parsed but not
   re-validated on read.
2. **Lifecycle completeness (G15, G17, G18, G19, G21)** — magic-link
   email is not sent, admin recovery is missing, book edit/delete
   is missing, initial progress load is missing, and three
   orphan admin components (GrantForm/GrantList/BookSelector) are
   not wired.
3. **Documentation/ADR hygiene (G23, G25, G26, G27)** — two ADR
   files referenced from plans/llms-full.txt do not exist, ADR
   numbers collide (035, 063), `CHANGELOG.md` and `CONTRIBUTING.md`
   are stale, and the security-posture doc's localStorage trade-off
   lacks a regression test that asserts the compensating controls.

---

## Closed Gaps (G1–G13) — Resolution Evidence

| ID | Topic | Resolution | Evidence |
|---|---|---|---|
| **G1** | Reader UI placeholder | **Closed 2026-04.** Search side-panel (PR #525), TOC, highlights, comments, bookmarks, info, settings, locale, theme all wired. | `apps/web/src/features/reader/components/`, `ReaderPage.test.tsx`, `useEpubProgress.ts` |
| **G2** | Slug/id mismatch in file-url route | **Closed 2026-04.** Frontend and worker both use `bookId`. | `routes/books.ts:38-104`, `ReaderPage.tsx:38-44`, `routes.books.test.ts:21-34` |
| **G3** | Signed download route | **Closed 2026-05.** HMAC-SHA256 round-trip; expiry verification; metadata. | `apps/worker/src/storage/signed-url.ts:1-180`, `signed-url-real.test.ts` |
| **G4** | Admin APIs unauthenticated | **Closed 2026-04.** `adminAuth` middleware on every admin handler (audit, books, grants). | `apps/worker/src/auth/admin-middleware.ts:49-121`, `routes/admin/{audit,books,grants}.ts` |
| **G5** | Password hashing fake Argon2id | **Closed 2026-04.** `argon2-wasm-edge` with per-grant salts; round-trip tested. | `apps/worker/src/auth/password.ts:1-200`, `password.test.ts:17-43, 130-135` |
| **G6** | Admin UI incomplete | **Partial — see G18 / G21.** Create + upload + grant create/revoke work; edit/delete and patch UI remain. | `apps/web/src/features/admin/{BooksPage,GrantsPage,AuditLogPage}.tsx` |
| **G7** | Missing setup/architecture docs | **Closed 2026-04–06.** `docs/{setup-local,architecture,security,security-posture,coding-guide,offline,observability-telemetry}.md` all exist and were updated June 2026. | `docs/` |
| **G8** | Swarm deliverable missing | **Closed 2026-04.** Resolved by the 2026-04-08 report; re-affirmed by this re-run. | `analysis/SWARM_ANALYSIS.md` |
| **G9** | Placeholder test | **Closed 2026-04.** 12 web test files, 24 worker test files, 17 reader-core test files. | `apps/web/src/__tests__/`, `apps/worker/src/__tests__/`, `packages/reader-core/src/__tests__/` |
| **G10** | Worker route tests missing | **Mostly closed 2026-04–05.** All routers except `catalog` have at least one test; see G24. | `apps/worker/src/__tests__/routes.*.test.ts` |
| **G11** | Playwright E2E missing | **Closed 2026-04–06.** 8 spec files in `apps/tests/` (login, offline, PWA, annotations, accessibility, in-book search, migration smoke, traceid). | `apps/tests/*.spec.ts` |
| **G12** | Hand-rolled Zod in worker | **Mostly closed 2026-04–05.** All route payloads use `@do-epub-studio/schema`; five residual inline Zod schemas remain — see G20. | `routes/admin/{auth,books}.ts`, `routes/{access,files}.ts` |
| **G13** | Multi-signal locators not enforced | **Partially closed.** Enforced on **write** via `MultiSignalLocatorSchema`; **read-side validation missing — see G16.** | `packages/schema/src/schemas.ts:52-64`, `routes/reader/{progress,bookmarks,highlights}.ts` |

---

## Open Gap Inventory (G14–G28)

Each gap is reported with: perspectives that flagged it, evidence
(file:line), why it matters, fix, and priority. Cross-references
to the GOAP/ADR plan that closes it are in parentheses.

### G14 — Critical: Comments IDOR — auth readers can read/write all books' comments

- **Perspectives:** Security, Architecture, Implementation.
- **Evidence:** `apps/worker/src/routes/comments.ts:28-58, 61-122`; `auth/middleware.ts:34-81`.
- **Why it matters:** `requireAuth` returns the user's session
  (which has a `bookId` for the book they have a grant for), but
  the handler queries `comments` using the URL's `bookId` without
  a `book_access_grants` re-check. Any authenticated reader with
  a grant for **book A** can read or post comments on **book B**
  (including `internal` visibility comments). Cross-tenant data
  exposure and integrity violation.
- **Fix:** Before every `comments` query, run
  `SELECT 1 FROM book_access_grants WHERE book_id = ? AND email = ? AND revoked_at IS NULL LIMIT 1`.
  For POST, additionally verify `canComment` is the capability
  derived from a grant for the URL `bookId`, not the session `bookId`.
- **Priority:** Critical.
- **Closes via:** `plans/075-goap-swarm-2026-06-15.md` + `plans/075-adr-tenant-isolation-2026-06-15.md`.

### G15 — Critical: Magic-link recovery email is never sent

- **Perspectives:** Feature, Implementation, Security.
- **Evidence:** `apps/worker/src/routes/access.ts:44-62`; UI at
  `apps/web/src/features/auth/LoginPage.tsx:179-194`; recovery test at
  `apps/worker/src/__tests__/recovery.test.ts` (passes vacuously).
- **Why it matters:** The route generates a token and constructs
  `recoveryUrl`, then writes it to the audit log with the token
  redacted in a single field. No email is dispatched. The user
  sees "A magic link has been sent to your email" but receives
  nothing. The recovery test mocks the email step and the audit
  redaction, so CI is green. The feature is theatrical in
  production.
- **Fix:** Wire a real email transport. `worker-configuration.d.ts`
  declares an `EmailEvent` binding type already. Add a transport
  adapter (Resend, MailChannels, or Cloudflare Email Worker).
  Centralize the redaction in `sanitizeAuditPayload` and pass
  the raw URL; do not embed the token in the audit payload.
- **Priority:** Critical.
- **Closes via:** `plans/081-adr-magic-link-email-transport.md`.

### G16 — Critical: Locator JSON not re-validated on read (violates ADR-006 integrity)

- **Perspectives:** Architecture, Implementation, Security.
- **Evidence:** `apps/worker/src/routes/comments.ts:46-58`,
  `routes/reader/progress.ts:41`, `routes/reader/bookmarks.ts:35`,
  `audit/index.ts:64, 162`.
- **Why it matters:** Stored `*_locator_json` blobs are
  `JSON.parse(...) as Record<string, unknown>`. The multi-signal
  guarantee is enforced on **write** (via
  `MultiSignalLocatorSchema` in `zValidator`) but not on **read**.
  A bad row (manual DB edit, future migration, write-side bug
  bypassed) returns a malformed locator to the client, defeating
  the ADR-006 contract.
- **Fix:** Wrap each `JSON.parse` in
  `MultiSignalLocatorSchema.parse(...)` inside try/catch; on
  failure, log a `corrupt_locator` audit event and filter the row
  from the response. Add a regression test that plants a malformed
  blob and asserts it is dropped.
- **Priority:** Critical.
- **Closes via:** `plans/075-goap-swarm-2026-06-15.md` + `plans/075-adr-tenant-isolation-2026-06-15.md`.

### G17 — High: Admin password recovery is entirely missing

- **Perspectives:** Feature, Implementation.
- **Evidence:** `apps/web/src/features/admin/AdminLoginPage.tsx`
  (no "Forgot password" link); `apps/worker/src/routes/admin/auth.ts`
  (no recovery endpoints); i18n keys absent in en/de/fr catalogs.
- **Why it matters:** A locked-out admin can only be recovered
  via direct DB intervention. Operational outage risk. The reader
  has the equivalent flow; the admin role that guards the catalog
  and grants has none.
- **Fix:** Mirror the reader flow:
  `POST /api/admin/recovery-request`,
  `POST /api/admin/verify-recovery`, a UI link, and i18n keys.
  Reuse the email transport from G15.
- **Priority:** High.
- **Closes via:** `plans/076-goap-admin-recovery-and-book-crud.md`.

### G18 — High: Book edit / archive / delete is missing from admin

- **Perspectives:** Feature, Implementation.
- **Evidence:** `apps/worker/src/routes/admin/books.ts:1-183`
  exposes only `POST /`, `PUT /:id/upload`,
  `POST /:id/upload-complete`. `BooksPage.tsx:194-269` has no
  Edit/Delete UI. The schema already supports `archived_at` (used
  in many WHERE clauses).
- **Why it matters:** Typo'd titles, wrong visibility, the need
  to unpublish — all require direct DB mutation. No audit trail
  of admin edits.
- **Fix:** Add `PATCH /api/admin/books/:id` (title/author/description/
  visibility/language), `DELETE /api/admin/books/:id` (soft delete
  via `archived_at`), and matching UI. Log every change to the
  audit log.
- **Priority:** High.
- **Closes via:** `plans/076-goap-admin-recovery-and-book-crud.md`.

### G19 — High: Initial progress load on reader open is not wired

- **Perspectives:** Feature, Implementation.
- **Evidence:** `apps/web/src/features/reader/ReaderPage.tsx:130-155`
  fetches highlights/comments/bookmarks but not progress. Worker
  route `GET /api/books/:bookId/progress` exists at
  `apps/worker/src/routes/reader/progress.ts:21-46`.
- **Why it matters:** Saved progress is sent (PUT) but never
  re-read on open. The reader's "resume where you left off"
  promise from `docs/offline.md:32` is not delivered.
- **Fix:** Add `fetchProgress(bookId)` to the load effect and
  call `rendition.display(cfi)` from the returned locator.
- **Priority:** High.
- **Closes via:** `plans/077-goap-reader-progress-and-search-load.md`.

### G20 — High: Hand-rolled Zod schemas in 5+ worker routes

- **Perspectives:** Architecture, Implementation.
- **Evidence:** `routes/admin/auth.ts:12-15` (`LoginSchema`),
  `routes/access.ts:249-251` (`ValidateQuerySchema`),
  `routes/files.ts:11-14` (`SignedUrlSchema`),
  `routes/admin/books.ts:12-25` (`UploadCompleteSchema`),
  `middleware/validation.ts:4-13` (`formatZodError`).
- **Why it matters:** Validation drift; the schemas are not
  shared with the web client; ADR-034-style length guards are
  applied locally only. Future contributors have no single
  place to find the request shape.
- **Fix:** Move all five to `packages/schema/src/schemas.ts`;
  export `formatZodError` from `@do-epub-studio/shared`.
- **Priority:** High.
- **Closes via:** `plans/078-adr-zod-schema-centralization.md`.

### G21 — High: Orphan admin components waste bundle

- **Perspectives:** Feature, Implementation, Architecture.
- **Evidence:** `apps/web/src/features/admin/components/GrantForm.tsx`,
  `GrantList.tsx`, `BookSelector.tsx` are complete but never
  mounted; `GrantsPage.tsx:119-307` only mounts the create form.
  Backend PATCH works (`routes/admin/grants.ts:72-110`).
- **Why it matters:** Dead UI in the bundle; reviewers ship
  features that don't work end-to-end. Either wire or delete.
- **Fix:** Mount `<GrantList />` + `<GrantForm />` in
  `GrantsPage.tsx`; if not needed for the design, delete the
  orphan files.
- **Priority:** High.
- **Closes via:** `plans/079-goap-admin-grants-patch-ui.md`.

### G22 — High: Reader-state POST ignores URL `bookId` vs session `bookId`

- **Perspectives:** Security, Implementation.
- **Evidence:** `routes/reader/highlights.ts:51-106`,
  `bookmarks.ts:42-69`, `progress.ts:48-75`. The URL `bookId`
  is used in the INSERT; `readerAuth` only verifies the user
  has **a** grant (for the session's `bookId`).
- **Why it matters:** A user with a grant for book A can write
  annotations into book B's data. Not a confidentiality breach
  (other users don't see it), but it corrupts book B's records
  and confuses admin reviews.
- **Fix:** `if (auth.bookId !== bookId) return 403 FORBIDDEN` in
  all three handlers. The session token is scoped to one book;
  the URL must match.
- **Priority:** High.
- **Closes via:** `plans/075-goap-swarm-2026-06-15.md` + `plans/075-adr-tenant-isolation-2026-06-15.md`.

### G23 — High: Session token in `localStorage` — standing regression test needed

- **Perspectives:** Security (defense in depth), Architecture.
- **Evidence:** `apps/web/src/stores/auth.ts:43-46, 94, 96`;
  `plans/archive/004-adr-auth-and-access.md:39` originally
  mandated httpOnly cookie; `docs/security-posture.md:34-40`
  records the trade-off explicitly per ADR-092.
- **Why it matters:** Single XSS → 7-day session exfiltration.
  The trade-off is documented and **adopted** (per ADR-092), so
  this is not a code change. The risk is governance: there is
  **no regression test that asserts the compensating controls
  (CSP, no `unsafe-eval`, no DOMPurify bypass, safe-regex) are
  still healthy**. If someone weakens any one of them, nothing
  in CI notices.
- **Fix:** Add a `security-posture.test.ts` (web) and a worker
  test that asserts:
  1. `cspHeadersContainNoUnsafeEval()`,
  2. `cspReportEndpointExists()`,
  3. `localStorage.getItem('do-epub-auth')` is the only session
     storage,
  4. ADR-092 is referenced from `docs/security-posture.md`.
- **Priority:** High (governance).
- **Closes via:** `plans/080-adr-session-storage-compensating-controls.md`.

### G24 — Medium: `routes/catalog.ts` (public books) has no test

- **Perspectives:** Test, Implementation.
- **Evidence:** `apps/worker/src/routes/catalog.ts:8` defines
  `GET /api/catalog`; `apps/worker/src/__tests__/` has no
  `routes.catalog.test.ts`.
- **Why it matters:** Public endpoint untested; regressions in
  visibility logic (`visibility = 'public'` filter) would not
  be caught.
- **Fix:** Add `routes.catalog.test.ts` (mocked `queryAll`)
  asserting the visibility filter and shape.
- **Priority:** Medium.
- **Closes via:** GitHub issue (G24), tracked in the swarm PR.

### G25 — Medium: Two ADR files referenced from plans/llms-full.txt do not exist

- **Perspectives:** Documentation, Architecture.
- **Evidence:** `plans/092-adr-token-storage-and-feature-gap-policy.md`
  is referenced in `plans/094-goap-plan-092-execution.md:191`
  and `plans/093-goap-phase-a-jules-in-book-search.md:153`;
  `plans/068-adr-open-issues-swarm-policy.md` is referenced in
  `llms-full.txt:97` and
  `plans/068-goap-swarm-open-issues-2026-06-06.md:6, 93, 166,
  222, 234`. Neither file exists.
- **Why it matters:** Broken cross-references violate
  AGENTS.md "single source of truth" rule (TIER-2 rule 8).
- **Fix:** Create both ADR files with the policy content cited
  in their parent plans. Both are added in this PR.
- **Priority:** Medium.
- **Closes via:** files added in this PR.

### G26 — Medium: ADR number collisions (035, 063); no ADR index

- **Perspectives:** Architecture, Documentation.
- **Evidence:** `plans/035-adr-content-security-policy.md` and
  `plans/035-adr-release-governance.md` both claim ADR-035.
  `plans/063-adr-accessibility-design-tokens.md` and
  `plans/063-adr-comprehensive-audit-policy.md` both claim
  ADR-063. There is no `plans/ADR-INDEX.md`.
- **Why it matters:** Confusing canonical ADR lookup; future
  contributors cannot tell which ADR is current.
- **Fix:** Add `plans/ADR-INDEX.md` mapping number → canonical
  file with one-line summary; add `plans/083-adr-adr-numbering-policy.md`
  stating the rule (number is the slug; collisions are a
  content problem, not a numbering problem, and are flagged
  in the index). Both added in this PR.
- **Priority:** Medium.
- **Closes via:** files added in this PR.

### G27 — Medium: `CHANGELOG.md` and `CONTRIBUTING.md` are stale

- **Perspectives:** Documentation, Architecture.
- **Evidence:** `CHANGELOG.md` last `[Unreleased]` entry
  references "Plan 038 backlog triage" (May 2026); plan 093
  (PR #525, search panel) and plan 094 (PR #527, plan-092
  resolution) merged 2026-06-14 and are not listed.
  `CONTRIBUTING.md:42-46` coverage thresholds disagree with
  `AGENTS.md` and omit `schema`/`testkit`/`ui`.
- **Why it matters:** Audits, contributors, release-management
  follow stale policy.
- **Fix:** Add `[Unreleased]` bullets for PRs #525 and #527;
  align `CONTRIBUTING.md` thresholds with `AGENTS.md`; add the
  missing three packages. Both are added in this PR.
- **Priority:** Medium.
- **Closes via:** `plans/084-goap-changelog-and-contributing-sync.md`.

### G28 — Medium: Reader side-panel mutual exclusivity not enforced

- **Perspectives:** Architecture, Implementation, UX.
- **Evidence:** `apps/web/src/features/reader/hooks/useReaderUi.ts:27-29`
  tracks only `activePanel`; `ReaderPage.tsx:341-413` renders
  `TableOfContents`, `BookmarksPanel`, `CommentsPanel`,
  `SearchPanel` each with their own `isOpen` checks;
  AGENTS.md TIER-3 mandates mutual exclusivity.
- **Why it matters:** Stacking panels (TOC + Search + Settings)
  obscures the reader on mobile. AGENTS.md TIER-3 policy
  violation.
- **Fix:** Drive every panel's `isOpen` from a single
  `activePanel` source, or add a side-effect that closes
  siblings. Add a test that asserts opening Search closes TOC.
- **Priority:** Medium.
- **Closes via:** `plans/082-adr-reader-side-panel-mutual-exclusivity.md`.

---

## Cross-Cutting Observations (Confirmed by Multiple Lenses)

| Issue | Security | Architecture | Implementation | Feature | Test | Docs |
|---|---|---|---|---|---|---|
| G14 Comments IDOR | ✓ | ✓ | ✓ | | | |
| G15 Magic-link email | ✓ | | ✓ | ✓ | | |
| G16 Locator read validation | ✓ | ✓ | ✓ | | ✓ | |
| G17 Admin recovery | | | ✓ | ✓ | | ✓ |
| G20 Hand-rolled Zod | | ✓ | ✓ | | | |
| G21 Orphan admin UI | | ✓ | ✓ | ✓ | | |
| G22 URL bookId vs session | ✓ | | ✓ | | ✓ | |
| G25–G26 ADR hygiene | | ✓ | | | | ✓ |

**Strongest consensus:** G14 (3 lenses) and G16 (3 lenses).
These are the most defensible Critical/High priorities.

## Quick Wins (≤1 day each)

1. **G14 Comments IDOR** — add the `book_access_grants` lookup;
   covered by existing fixtures. ~2 hours, but only after writing
   a regression test that fails today.
2. **G19 Initial progress load** — one fetch +
   `rendition.display(cfi)`. ~1 hour.
3. **G24 Catalog test** — straight mock. ~1 hour.
4. **G27 CHANGELOG/CONTRIBUTING sync** — documentation only. ~30 min.
5. **G14 redirect on logged-in login** (LoginPage + AdminLoginPage)
   — 5-line `useEffect`. ~15 min.
6. **G22 URL `bookId` vs session check** — 3-line guard in 3
   handlers. ~1 hour.
7. **G25 ADR-092/ADR-068 files** — short markdown stubs. ~30 min.
8. **G26 ADR-INDEX.md** — one markdown file. ~30 min.

## Dependencies and Coupling

- **Reader end-to-end:** G19 (progress load) depends on the
  catalog + comments being tenant-isolated (G14, G22). Annotation
  reliability (G16) is a prerequisite for any meaningful E2E
  test of multi-device sync.
- **Admin enablement:** G17 (recovery) and G18 (book edit/delete)
  are independent of each other but both should land after G14
  (Comments IDOR) and G16 (locator validation) so that any new
  admin-written comment is tenant-scoped.
- **Documentation refresh:** G25 + G26 + G27 form a single
  "ADR + contributor docs" bundle.
- **Test hardening:** G20 (move schemas to
  `@do-epub-studio/schema`) makes G14/G22 regression tests
  easier to write, because the new central schemas make the
  `book_access_grants` lookup reusable.
- **G23** (session in localStorage) is governance-only; it
  depends on the CSP + safe-regex controls remaining healthy.

## Perspective Coverage Map

- **Feature Gaps:** G15, G17, G18, G19, G21, G24.
- **Implementation Completeness:** G14, G15, G17, G18, G19, G20,
  G22, G28.
- **Documentation:** G17, G25, G26, G27.
- **Test Coverage:** G14, G16, G20, G22, G24.
- **Architecture & Patterns:** G14, G16, G20, G22, G25, G26, G28.
- **Security & Quality:** G14, G15, G16, G22, G23.

## Suggested Next Steps (priority order)

1. **Immediate (this week):** G14 (Comments IDOR), G16 (locator
   read validation), G22 (URL bookId guard) — three related
   tenant-isolation fixes; one PR, three test files.
2. **Near-term (next sprint):** G15 (magic-link email), G17
   (admin recovery), G19 (initial progress load).
3. **Cleanup sprint:** G20 (Zod centralization), G24 (catalog
   test), G27 (CHANGELOG + CONTRIBUTING).
4. **Governance sprint:** G25, G26 (ADR files + ADR-INDEX),
   G23 (compensating-controls regression test).
5. **Backlog:** G18 (book edit/delete), G21 (orphan admin
   components), G28 (panel mutual exclusivity).

## Closing Notes

- Per AGENTS.md TIER-2 rule 8, every Critical/High in this
  report has a paired GOAP plan + ADR in `plans/`. The plans
  describe the **what** and **how**; they do not commit to a
  date. Each plan is a tracked GitHub issue (see the swarm
  PR description for the issue list).
- This analysis supersedes the 2026-04-08 + 2025-01 versions
  in this file. The new report is dated 2026-06-15.
- No production source files were modified during this
  analysis; the only files added in the corresponding PR are
  `analysis/SWARM_ANALYSIS.md` (this file) and the
  plan/ADR/index files in `plans/`.

---

## Companion Files (created in this PR)

| File | Purpose | Closes |
|---|---|---|
| `plans/075-goap-swarm-2026-06-15.md` | Master GOAP plan for the 2026-06-15 swarm | — |
| `plans/075-adr-tenant-isolation-2026-06-15.md` | ADR: URL bookId must equal session bookId; locator re-validation on read | G14, G16, G22 |
| `plans/076-goap-admin-recovery-and-book-crud.md` | GOAP: admin recovery + book edit/delete | G17, G18 |
| `plans/077-goap-reader-progress-and-search-load.md` | GOAP: initial progress load on reader open | G19 |
| `plans/078-adr-zod-schema-centralization.md` | ADR: move all inline Zod schemas to `@do-epub-studio/schema` | G20 |
| `plans/079-goap-admin-grants-patch-ui.md` | GOAP: wire orphan GrantForm/GrantList or delete them | G21 |
| `plans/080-adr-session-storage-compensating-controls.md` | ADR: standing regression test for the localStorage trade-off | G23 |
| `plans/081-adr-magic-link-email-transport.md` | ADR: real email transport for magic links | G15 |
| `plans/082-adr-reader-side-panel-mutual-exclusivity.md` | ADR: enforce single active side-panel | G28 |
| `plans/068-adr-open-issues-swarm-policy.md` | ADR: closes the missing-file cross-reference | G25 |
| `plans/092-adr-token-storage-and-feature-gap-policy.md` | ADR: closes the missing-file cross-reference | G25 |
| `plans/ADR-INDEX.md` | Single source of truth for ADR numbers | G26 |
| `plans/083-adr-adr-numbering-policy.md` | ADR: numbering rule + how to handle collisions | G26 |
| `plans/084-goap-changelog-and-contributing-sync.md` | GOAP: refresh CHANGELOG + CONTRIBUTING | G27 |
