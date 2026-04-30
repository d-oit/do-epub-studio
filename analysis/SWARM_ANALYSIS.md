# Swarm Analysis - 2026-04-08

Coordinated "analysis-swarm" agents inspected the repository
across six perspectives: Feature Gaps, Implementation
Completeness, Documentation, Test Coverage, Architecture &
Patterns, and Security & Quality. 12 high-signal gaps remain
(2 Critical, 6 High, 4 Medium). Several issues overlap
multiple perspectives, underscoring systemic weaknesses
around access control, signed downloads, and password
storage. This report replaces the previously missing swarm
deliverable noted in
plans/analysis-swarm-2026-04-08.md.

## Gap Inventory

### G1 - Feature

**What's Missing:** Reader UI only renders a placeholder card;
EPUB.js loader, progress sync, highlights/comments, and
capability gating are not wired.

**Why It Matters:** Readers cannot open books, resume progress,
or use editorial tools, making the core product unusable.

**Priority:** High

**Suggested Fix:** Implement `createEpubLoader` and hook it
into `ReaderPage`, hydrate capability-aware state (progress,
highlights, comments), and surface navigation + annotation
controls backed by Worker APIs.

**Evidence:**
`apps/web/src/features/reader/ReaderPage.tsx:12-139`,
`packages/reader-core/src/epub-loader.ts:22-41`

### G2 - Feature, Implementation

**What's Missing:** Frontend requests
`/api/books/{slug}/file-url` but Worker treats the param as a
`bookId`, so lookups always fail.

**Why It Matters:** Every attempt to fetch an EPUB URL returns
404, blocking reader access and downstream offline caching.

**Priority:** Critical

**Suggested Fix:** Align identifier usage by either updating
the frontend to send book IDs or teaching the Worker route to
resolve slugs to IDs before querying Turso. Add regression
tests for both forms.

**Evidence:**
`apps/web/src/features/reader/ReaderPage.tsx:38-44`,
`apps/worker/src/routes/books.ts:85-104`

### G3 - Implementation, Security

**What's Missing:** Signed download URLs target
`/api/files/:bookId/:fileKey` with expiry/signature but no
Worker route exists and verification only checks timestamps.

**Why It Matters:** Files cannot be downloaded at all; any
future handler would lack signature enforcement, violating the
R2 access rule.

**Priority:** High

**Suggested Fix:** Add a Worker route that validates both
expiry and HMAC signature before streaming the R2 object;
derive the base URL from the incoming request instead of
APP_BASE_URL.

**Evidence:**
`apps/worker/src/storage/signed-url.ts:10-52`,
`apps/worker/src/index.ts:52-179`

### G4 - Implementation, Security

**What's Missing:** `/api/admin/**` handlers skip
authentication/authorization entirely.

**Why It Matters:** Any unauthenticated caller can create
books, mint or revoke grants, and tamper with audit logs -
total privilege escalation.

**Priority:** Critical

**Suggested Fix:** Introduce admin auth middleware, enforce
`canManageAccess` (or role) inside each handler, and emit
audit events including actor metadata.

**Evidence:**
`apps/worker/src/index.ts:142-179`,
`apps/worker/src/routes/admin.ts:30-235`

### G5 - Security, Quality

**What's Missing:** `hashPassword`/`verifyPassword` fake
Argon2id by wrapping a plain SHA-256 digest without salts.

**Why It Matters:** Grant passwords are trivial to brute-force,
breaching security requirements and undermining distribution
controls.

**Priority:** High

**Suggested Fix:** Replace with a Workers-compatible Argon2id
implementation (e.g., WASM), store random per-grant salts, and
migrate stored hashes.

**Evidence:**
`apps/worker/src/auth/password.ts:26-64`,
`AGENTS.md:51-66`

### G6 - Feature

**What's Missing:** Admin UI lists books but cannot create
uploads or manage grants - the "Create New Book" button is
inert, and no grant UI exists.

**Why It Matters:** Admin workflows (ingest EPUBs, invite
readers, revoke access) cannot be performed, blocking
deployment even if worker APIs were secured.

**Priority:** Medium

**Suggested Fix:** Build modal/forms that POST
`/api/admin/books` and grant endpoints, wire uploads to R2,
and display grant lists with create/update/revoke actions tied
to audit logging.

**Evidence:**
`apps/web/src/features/admin/BooksPage.tsx:34-155`

### G7 - Documentation

**What's Missing:** README references `docs/setup-local.md`,
and the coding guide references multiple
architecture/security/offline docs that do not exist.

**Why It Matters:** Onboarding and compliance rely on
non-existent guides, so contributors cannot set up
Turso/Workers or follow required architecture practices.

**Priority:** Medium

**Suggested Fix:** Author the missing setup/architecture/
security/offline documents or update references to point at
real instructions in `docs/` and `plans/`.

**Evidence:** `README.md:26-29`,
`docs/coding-guide.md:524-532`

### G8 - Documentation

**What's Missing:** Swarm deliverable
(`analysis/SWARM_ANALYSIS.md`) was absent despite being
mandated in `plans/analysis-swarm-2026-04-08.md`.

**Why It Matters:** Without an aggregated findings file,
stakeholders had no traceable output for the swarm effort.

**Priority:** Medium (resolved)

**Suggested Fix:** **Addressed by this report.** Keep this file
updated on future swarms and link from plans.

**Evidence:**
`plans/analysis-swarm-2026-04-08.md:5-23`, `analysis/`
directory listing prior to this run

### G9 - Testing

**What's Missing:** Only test asserts `1 + 1 === 2`; Worker,
shared packages, and React state all lack unit tests.

**Why It Matters:** CI passes even if core auth/offline logic
regresses, providing zero real coverage.

**Priority:** High

**Suggested Fix:** Replace placeholder with package-specific
Vitest suites (shared schemas, Zustand stores, worker routes).
Use `vitest.workspace.ts` to run every package.

**Evidence:**
`apps/web/src/__tests__/placeholder.test.ts:1-6`,
`vitest.workspace.ts:3-5`

### G10 - Testing

**What's Missing:** Worker access/book routes have zero tests;
no integration tests validate DB queries, signed URLs, or grant
enforcement.

**Why It Matters:** Security-sensitive behavior can regress
silently, violating ADR-004/005 and access guarantees.

**Priority:** High

**Suggested Fix:** Create Vitest suites for worker handlers
(books, access, reader-state) using mocked env + SQLite
fixtures; add contract tests for signed URL generation/
verification.

**Evidence:**
`apps/worker/src/routes/books.ts:1-140`,
`apps/worker/src/routes/reader-state.ts:74-304`

### G11 - Testing

**What's Missing:** Playwright config exists but there are no
`.spec.ts` files, so auth/reader journeys lack E2E coverage.

**Why It Matters:** UI + Worker integration (login, book load,
localization, offline prompts) are unverified, risking
regressions in the core UX.

**Priority:** High

**Suggested Fix:** Add Playwright specs under `apps/web/tests`
covering login, book loading, annotation start, and locale
switching; wire them into CI.

**Evidence:** `playwright.config.ts:1-19`,
`apps/web/package.json:7-14`

### G12 - Architecture

**What's Missing:** Worker routes deserialize JSON manually
instead of using shared Zod schemas, so validation/localization
rules are inconsistent.

**Why It Matters:** Malformed payloads can bypass validation,
and localized error messaging cannot be enforced, violating
architecture rules.

**Priority:** Medium

**Suggested Fix:** Import schemas from `packages/shared` (e.g.,
AccessRequestSchema, ProgressUpdateSchema) and parse requests
through them; translate errors based on locale.

**Evidence:**
`packages/shared/src/schemas.ts:39-131`,
`apps/worker/src/routes/access.ts:13-68`

### G13 - Security, Architecture

**What's Missing:** Reader-state endpoints do not require
multi-signal annotation locators (CFI + text + chapter) nor
ensure bookId scoping when updating progress/highlights.

**Why It Matters:** Anchors drift across EPUB versions and
readers can mutate other books' state if they know an ID,
breaking ADR-006 and tenant isolation.

**Priority:** High

**Suggested Fix:** Require session bookId matching and enforce
multi-signal locator schema for highlights/comments before
writes; extend tests to cover enforcement.

**Evidence:**
`apps/worker/src/routes/reader-state.ts:74-304`,
`packages/shared/src/schemas.ts:39-115`,
`AGENTS.md:60-73`

## Quick Wins

- **G2 (slug/id mismatch):** Update the frontend fetch parameter
  or worker lookup logic; change is localized and unlocks
  reading immediately.
- **G7 (missing setup docs):** Creating the referenced markdown
  files or adjusting README links requires documentation work
  only and unblocks onboarding.
- **G8 (swarm deliverable):** Report now exists; future runs
  just need incremental edits.
- **G12 (schema validation):** Importing shared Zod schemas
  into worker routes is straightforward and improves
  reliability fast.

## Issues Confirmed by Multiple Perspectives

- **G3 / G4 / G5:** Identified independently by
  Feature/Implementation and Architecture/Security agents,
  signaling consensus on missing file routes, admin auth, and
  password hashing weaknesses.
- **G2 and G1:** Feature agent highlighted the slug/id failure
  (G2) that directly blocks the broader reader feature gap
  (G1).
- **G13:** Security and Architecture lenses both flagged absent
  book scoping + annotation locator enforcement, linking data
  integrity with UX requirements.

## Dependencies and Coupling

- **Reader enablement:** Delivering G1 depends on fixing G2
  (file lookup) and G3 (download route). Offline caching also
  requires G3 for signed URLs.
- **Admin workflows:** UI work in G6 must wait for G4 (lock
  down admin APIs) and G5 (secure passwords) to avoid building
  atop unsafe endpoints.
- **Testing:** Meaningful worker and E2E tests (G10, G11) rely
  on schema validation (G12) and trusted auth flows (G4, G5)
  so they can assert deterministic outcomes.
- **Annotation reliability:** Enforcing multi-signal locators
  (part of G13) requires shared schema enforcement (G12) and
  book scoping fixes within the same endpoints.

## Perspective Coverage Map

- **Feature Gaps:** G1, G2, G3, G6.
- **Implementation Completeness:** G2, G3, G4, G5.
- **Documentation:** G7, G8.
- **Test Coverage:** G9, G10, G11.
- **Architecture & Patterns:** G12, G13.
- **Security & Quality:** G3, G4, G5, G13.

## Suggested Next Steps

1. Patch critical security blockers first (G2-G5) to restore
   safe book access and admin controls.
2. Stand up basic Reader UI + signed downloads (G1, G3) so
   end-to-end flows exist for testing.
3. Create the missing documentation set (G7) and keep this file
   updated (G8) for future swarms.
4. Invest in real unit + integration + Playwright suites
   (G9-G11) once critical flows exist.
5. Harden schemas and annotation locators (G12-G13) to meet
   ADR requirements and prepare for offline sync work.

---

## Additional Findings (2025-01-XX)

### Security Audit (security-code-auditor skill)

The security audit confirmed:
- ✅ **G5 RESOLVED**: Password hashing properly uses Argon2id
- ✅ **SQL Injection**: All queries use parameterized queries - secure
- ✅ **No Hardcoded Secrets**: All credentials via Env interface
- ✅ **Signed URLs**: Proper HMAC-SHA256 implementation
- ❌ **G4 CRITICAL**: Admin APIs still lack authorization - confirmed by code inspection

### Code Quality Analysis (code-quality skill)

**New issues identified (CQ-1, CQ-2):**

| ID | File | Lines | Issue | Recommendation |
|----|------|-------|-------|----------------|
| CQ-1 | `apps/web/src/features/reader/ReaderPage.tsx` | 1123 | Exceeds 500 LOC limit | Split into TocSidebar, AnnotationToolbar, ProgressIndicator |
| CQ-2 | `apps/web/src/features/admin/GrantsPage.tsx` | 740 | Exceeds 500 LOC limit | Split into GrantForm, BookSelector, GrantList |

**Positive findings:**
- ✅ No `any` type in production code (only in test mocks - justified)
- ✅ Excellent error handling in api.ts and validation.ts
- ✅ Well-implemented Zod schema validation in worker routes

### Testing Strategy Assessment (testing-strategy skill)

**Test coverage metrics:**

| Type | Target | Current | Gap |
|------|--------|---------|-----|
| Business Logic | > 90% | ~70% | 20% |
| API Routes | > 80% | ~75% | 5% |
| UI Components | > 70% | ~60% | 10% |
| Overall | > 80% | ~65% | 15% |

**Critical test gaps identified:**
- T-1: CFI Navigation tests (High priority)
- T-2: EPUB Parsing integration tests (High priority)
- T-3: Password Hashing security test (High priority)
- T-4: Bookmark CRUD tests (Medium priority)

### Updated Gap Inventory

| ID | Category | Issue | Severity | Status | Notes |
|----|----------|-------|----------|--------|-------|
| G1 | Feature | Reader UI not wired | High | Open | |
| G2 | Feature | slug/id mismatch | Critical | Open | |
| G3 | Feature | Signed download route | High | Open | |
| G4 | Security | Admin APIs no auth | Critical | Open | Confirmed by code inspection |
| G5 | Security | Argon2id | - | ✅ Fixed | Confirmed secure |
| G6 | Feature | Admin UI incomplete | Medium | Open | |
| G7 | Docs | Setup docs missing | Medium | Open | |
| G9 | Testing | Placeholder tests | High | ✅ Fixed | |
| G10 | Testing | Worker route tests | High | Partial | |
| G11 | Testing | Playwright E2E | High | Partial | |
| G12 | Architecture | Schema validation | Medium | ✅ Good | |
| G13 | Security | Multi-signal locators | High | Open | |
| CQ-1 | Quality | ReaderPage.tsx 1123 LOC | High | Open | NEW - Exceeds 500 LOC |
| CQ-2 | Quality | GrantsPage.tsx 740 LOC | Medium | Open | NEW - Exceeds 500 LOC |
| T-1 | Testing | CFI Navigation | High | Open | NEW |
| T-2 | Testing | EPUB Parsing | High | Open | NEW |
| T-3 | Testing | Password Hashing | High | Open | NEW |
| T-4 | Testing | Bookmark CRUD | Medium | Open | NEW |

### Skills Used in Extended Analysis

- `security-code-auditor` - Full security vulnerability assessment
- `code-quality` - Code quality and linting analysis
- `testing-strategy` - Test coverage evaluation
- `epub-rendering-and-cfi` - EPUB rendering context

### References

- Full analysis details: `plans/012-comprehensive-analysis-findings.md`
