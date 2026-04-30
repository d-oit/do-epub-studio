# Plan 012: Comprehensive Codebase Analysis Findings

## Executive Summary

This plan consolidates findings from multi-skill agent analysis including:
- **Security Code Audit** (security-code-auditor skill)
- **Code Quality Analysis** (code-quality skill)
- **Testing Strategy Assessment** (testing-strategy skill)
- **SWARM_ANALYSIS.md** gap inventory

Date: 2025-01-XX
Analysis conducted using: security-code-auditor, code-quality, testing-strategy, epub-rendering-and-cfi skills

---

## Part A: Critical Security Issues

### 🔴 CRITICAL: Admin API Has No Authorization

**Issue:** All 8 admin handler functions completely skip authentication/authorization.

**Affected File:** `apps/worker/src/routes/admin.ts`

**Vulnerability:** Any unauthenticated caller can:
- Create books
- Mint or revoke grants
- View all audit logs

**Evidence:**
```do-epub-studio/apps/worker/src/routes/admin.ts#L1-10
// No import of requireAdminAuth!
import type { Env } from '../lib/env';
import { execute, queryAll, queryFirst } from '../db/client';
```

**Affected Handlers:**
- `handleCreateBook` - Line ~46
- `handleBookUpload` - Line ~90
- `handleUploadComplete` - Line ~130
- `handleCreateAdminGrant` - Line ~170
- `handleUpdateGrant` - Line ~220
- `handleRevokeGrant` - Line ~270
- `handleGetBookGrants` - Line ~320
- `handleGetAuditLog` - Line ~370

**Contrast with correct implementation in `admin-middleware.ts`:**
```do-epub-studio/apps/worker/src/auth/admin-middleware.ts#L46-64
export async function requireAdminAuth(
  env: Env,
  request: Request,
): Promise<{ ok: true; context: AdminAuthContext } | { ok: false; status: number; error: string }> {
  // Proper token validation, session lookup, role checking...
}
```

**Recommendation:**
```do-epub-studio/apps/worker/src/routes/admin.ts
import { requireAdminAuth } from '../auth/admin-middleware';

export async function handleCreateBook(
  env: Env,
  request: Request,
  rawBody: unknown,
): Promise<Response> {
  // Add authorization check at the start
  const auth = await requireAdminAuth(env, request);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: { code: 'FORBIDDEN', message: auth.error } }, auth.status);
  }
  
  const actorEmail = auth.context.email;
  // ... rest of function
}
```

**Priority:** P0 - Critical
**Status:** Open

---

### 🟢 Security: Password Hashing - SECURE

**File:** `apps/worker/src/auth/password.ts`

**Finding:** ✅ Properly implemented with Argon2id

```do-epub-studio/apps/worker/src/auth/password.ts#L16-31
const MEMORY_COST_KIB = 65536; // 64 MiB
const ITERATIONS = 3;
const PARALLELISM = 4;
const HASH_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const hash = await argon2id({
    password,
    salt,
    iterations: ITERATIONS,
    parallelism: PARALLELISM,
    memorySize: MEMORY_COST_KIB,
    hashLength: HASH_LENGTH,
    outputType: 'encoded',
  });

  return hash;
}
```

**Security Assessment:**
- ✅ Uses Argon2id (per AGENTS.md requirement)
- ✅ Cryptographically secure random 16-byte salt
- ✅ Strong memory cost: 64 MiB
- ✅ Proper iteration count (3) and parallelism (4)
- ✅ Password verification handles errors gracefully

**Status:** ✅ SECURE - No action needed

---

### 🟢 Security: SQL Injection - SECURE

**Searched Files:**
- `apps/worker/src/routes/admin.ts`
- `apps/worker/src/routes/books.ts`
- `apps/worker/src/routes/access.ts`
- `apps/worker/src/auth/middleware.ts`
- `apps/worker/src/auth/admin-middleware.ts`

**Finding:** ✅ All database queries use parameterized queries

```do-epub-studio/apps/worker/src/routes/admin.ts#L71-78
await execute(
  env,
  `INSERT INTO books (id, slug, title, author_name, description, language, visibility, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [id, body.slug.toLowerCase(), body.title, ...],
);
```

**Status:** ✅ SECURE - No string concatenation in SQL

---

### 🟢 Security: No Hardcoded Secrets

**Searched Patterns:** API keys, tokens, passwords, AWS keys, GitHub tokens

**Finding:** ✅ No hardcoded secrets found. All sensitive values use Env interface:

```do-epub-studio/apps/worker/src/lib/env.ts#L1-7
export interface Env {
  BOOKS_BUCKET: R2Bucket;
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  SESSION_SIGNING_SECRET: string;
  INVITE_TOKEN_SECRET: string;
  APP_BASE_URL: string;
}
```

**Status:** ✅ SECURE

---

### 🟢 Security: Signed URLs - SECURE

**File:** `apps/worker/src/storage/signed-url.ts`

**Finding:** ✅ Proper HMAC-SHA256 implementation

```do-epub-studio/apps/worker/src/storage/signed-url.ts#L14-27
const SIGNED_URL_EXPIRY_SECONDS = 3600;  // 1 hour

async function computeSignature(
  secret: string,
  bookId: string,
  fileKey: string,
  expiresEpoch: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${bookId}:${fileKey}:${expiresEpoch}:${secret}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  // ...
}
```

**Status:** ✅ SECURE - but see Feature Gap G3 (route not implemented)

---

## Part B: Code Quality Issues

### 🔴 Code Quality: Files Exceeding 500 LOC Limit

**Per AGENTS.md:** `MAX_LINES_PER_SOURCE_FILE=500`

| File | Lines | Severity | Recommendation |
|------|-------|----------|----------------|
| `apps/web/src/features/reader/ReaderPage.tsx` | **1123** | 🔴 Critical | Split into TocSidebar, AnnotationToolbar, ProgressIndicator |
| `apps/web/src/features/admin/GrantsPage.tsx` | **740** | 🔴 High | Split into GrantForm, BookSelector, GrantList |
| `apps/web/src/features/reader/components/annotations/CommentsPanel.tsx` | **544** | ⚠️ Medium | Consider splitting |
| `apps/web/src/components/ui/index.tsx` | **525** | ⚠️ Medium | Could split design system |
| `apps/worker/src/routes/reader-state.ts` | **482** | ⚠️ Near | Monitor |
| `apps/worker/src/routes/admin.ts` | **465** | ⚠️ Near | Monitor |

**Recommended Refactor for ReaderPage.tsx:**
```
apps/web/src/features/reader/
├── ReaderPage.tsx           # Main container (~200 LOC)
├── components/
│   ├── TocSidebar.tsx       # Table of Contents (~150 LOC)
│   ├── AnnotationToolbar.tsx # Highlight/Comment controls (~150 LOC)
│   └── ProgressIndicator.tsx # Reading progress bar (~100 LOC)
├── hooks/
│   └── useReaderState.ts    # Reader state management
└── ...
```

**Status:** Open - Needs refactoring

---

### 🟢 Code Quality: `any` Type Usage

**Finding:** ✅ Minimal usage - only in test mocks

```do-epub-studio/apps/web/src/__tests__/offline-sync.test.ts#L49
const listeners: Map<string, ((...args: any[]) => void)[]> = new Map();
```

This is **justified** in test setup code - acceptable.

**Status:** ✅ Clean - No `any` in production code

---

### 🟢 Code Quality: Error Handling

**Finding:** ✅ Excellent centralized error handling

| File | Status |
|------|--------|
| `apps/web/src/lib/api.ts` | ✅ Excellent - centralized with telemetry |
| `apps/worker/src/lib/validation.ts` | ✅ Uses Zod with proper error details |

**Minor observation:** Telemetry has `console.log` for info-level events - could be removed in production.

**Status:** ✅ Good

---

### 🟢 Code Quality: Zod Schema Usage

**Finding:** ✅ Well implemented

- Validation centralized in `apps/worker/src/lib/validation.ts`
- Schemas imported from `@do-epub-studio/shared`
- Proper error mapping

**Status:** ✅ Excellent

---

## Part C: Feature Gaps (from SWARM_ANALYSIS + Analysis)

### G1 - Reader UI Not Wired to Backend

**What's Missing:** Reader UI only renders a placeholder card; EPUB.js loader, progress sync, highlights/comments, and capability gating are not wired.

**Priority:** High

**Suggested Fix:** Implement `createEpubLoader` and hook it into `ReaderPage`, hydrate capability-aware state (progress, highlights, comments), and surface navigation + annotation controls backed by Worker APIs.

**Evidence:** `apps/web/src/features/reader/ReaderPage.tsx:12-139`, `packages/reader-core/src/epub-loader.ts:22-41`

**Status:** Open

---

### G2 - slug/id Mismatch (Critical)

**What's Missing:** Frontend requests `/api/books/{slug}/file-url` but Worker treats the param as a `bookId`, so lookups always fail.

**Priority:** Critical

**Suggested Fix:** Align identifier usage by either updating the frontend to send book IDs or teaching the Worker route to resolve slugs to IDs before querying Turso.

**Evidence:** `apps/web/src/features/reader/ReaderPage.tsx:38-44`, `apps/worker/src/routes/books.ts:85-104`

**Status:** Open

---

### G3 - Signed Download Route Missing

**What's Missing:** Signed download URLs target `/api/files/:bookId/:fileKey` with expiry/signature but no Worker route exists and verification only checks timestamps.

**Priority:** High

**Suggested Fix:** Add a Worker route that validates both expiry and HMAC signature before streaming the R2 object.

**Evidence:** `apps/worker/src/storage/signed-url.ts:10-52`, `apps/worker/src/index.ts:52-179`

**Status:** Open

---

### G4 - Admin Auth Missing (COVERED IN PART A)

See Part A: Admin API Has No Authorization

**Status:** Open

---

### G6 - Admin UI Incomplete

**What's Missing:** Admin UI lists books but cannot create uploads or manage grants - the "Create New Book" button is inert, and no grant UI exists.

**Priority:** Medium

**Suggested Fix:** Build modal/forms that POST `/api/admin/books` and grant endpoints, wire uploads to R2, and display grant lists with create/update/revoke actions tied to audit logging.

**Evidence:** `apps/web/src/features/admin/BooksPage.tsx:34-155`

**Status:** Open

---

### G13 - Multi-signal Locators Not Enforced

**What's Missing:** Reader-state endpoints do not require multi-signal annotation locators (CFI + text + chapter) nor ensure bookId scoping when updating progress/highlights.

**Priority:** High

**Suggested Fix:** Require session bookId matching and enforce multi-signal locator schema for highlights/comments before writes; extend tests to cover enforcement.

**Evidence:** `apps/worker/src/routes/reader-state.ts:74-304`, `packages/shared/src/schemas.ts:39-115`, `AGENTS.md:60-73`

**Status:** Open

---

## Part D: Testing Gaps

### T1 - Missing Critical Tests

| Gap | Severity | Recommendation |
|-----|----------|----------------|
| CFI Navigation | High | Add unit tests for CFI parsing/navigation |
| EPUB Parsing | High | Add integration tests for EPUB.js |
| Password Hashing | High | Add test for Argon2id (security critical) |
| Real API Integration | High | Add tests with actual backend, not just mocks |
| Bookmark CRUD | Medium | Add tests for bookmark create/read/update/delete |

### T2 - Current Test Coverage

**Vitest Unit/Integration Tests:**

| Location | Files | Focus |
|----------|-------|-------|
| `apps/web/src/__tests__/` | 7 files | Frontend API client, stores, offline sync |
| `apps/worker/src/__tests__/` | 9 files | Worker routes |

**Playwright E2E Tests:**

| Location | Files | Focus |
|----------|-------|-------|
| `apps/tests/` | 4 files | Login, reader, annotations, accessibility |

### T2b - Property-Based Testing Opportunity (NEW)

**See Plan 013:** Fast-Check Property-Based Testing Integration

Property-based testing with fast-check could significantly improve:
- Security function edge case coverage
- Schema validation robustness
- Complex parsing (CFI, locators) reliability

Key opportunity areas:
- `apps/worker/src/auth/` - Auth header parsing, token generation
- `packages/shared/src/schemas.ts` - All Zod schema edge cases
- `packages/reader-core/src/` - Locator parsing, reanchoring

### T3 - Coverage Metrics

| Type | Target | Current | Status |
|------|--------|---------|--------|
| Business Logic | > 90% | ~70% | ⚠️ Need more |
| API Routes | > 80% | ~75% | ⚠️ Need more |
| UI Components | > 70% | ~60% | ⚠️ Need more |
| Overall | > 80% | ~65% | ⚠️ Need more |

**Status:** Open - Testing needs expansion

---

## Part E: Documentation Gaps

### D1 - Missing Setup Documentation

**What's Missing:** README references `docs/setup-local.md`, and the coding guide references multiple architecture/security/offline docs that do not exist.

**Priority:** Medium

**Suggested Fix:** Author the missing setup/architecture/security/offline documents or update references.

**Evidence:** `README.md:26-29`, `docs/coding-guide.md:524-532`

**Status:** Open

---

## Part F: Implementation Status

### From plans/007-implementation-phases.md

| Item | Status |
|------|--------|
| Initial monorepo setup (Vite, PWA, Worker) | ✅ Complete |
| Turso / libSQL schema & migrations | ✅ Complete |
| EPUB.js basic integration | ✅ Complete |
| Global error interceptors for 401/403 responses | ✅ Complete |
| Unskip and fix Admin/Reader unit tests | ✅ Complete |
| Reader annotation anchor engine (ADR-006) | 🔴 Open |

---

## Part G: Comprehensive Gap Inventory

| ID | Category | Issue | Severity | Status |
|----|----------|-------|----------|--------|
| G1 | Feature | Reader UI not wired to backend | High | Open |
| G2 | Feature | slug/id mismatch for file URLs | Critical | Open |
| G3 | Feature | Signed download route missing | High | Open |
| G4 | Security | Admin APIs have no auth | Critical | Open |
| G5 | Security | None - Argon2id properly implemented | - | ✅ Fixed |
| G6 | Feature | Admin UI incomplete | Medium | Open |
| G7 | Docs | Setup docs missing | Medium | Open |
| G9 | Testing | Placeholder tests | High | ✅ Fixed |
| G10 | Testing | Worker route tests | High | Partial |
| G11 | Testing | Playwright E2E | High | Partial |
| G12 | Architecture | Schema validation | Medium | ✅ Good |
| G13 | Security | Multi-signal locators | High | Open |
| CQ-1 | Quality | ReaderPage.tsx at 1123 LOC | High | Open |
| CQ-2 | Quality | GrantsPage.tsx at 740 LOC | Medium | Open |
| T-1 | Testing | CFI navigation tests | High | Open |
| T-2 | Testing | EPUB parsing tests | High | Open |
| T-3 | Testing | Password hashing test | High | Open |
| T-4 | Testing | Bookmark CRUD tests | Medium | Open |

---

## Recommended Priority Order

### Immediate (This Sprint)
1. **Fix G4** - Add admin auth middleware to all admin routes (Critical Security)
2. **Fix G2** - Align slug/id between frontend and worker (Unblocks reading)
3. **Fix G3** - Implement signed file download route (Unblocks downloads)

### Short Term (Next 2 Sprints)
4. Wire Reader UI to EPUB.js backend
5. Refactor ReaderPage.tsx (split into components)
6. Refactor GrantsPage.tsx (split into components)
7. Add missing tests (CFI, password hashing, bookmarks)

### Medium Term
8. Complete Admin UI workflow (book creation, grants)
9. Add Playwright E2E for real API flows
10. Expand offline sync capabilities
11. Add multi-language enhancements

---

## Acceptance Criteria

### Security (P0)
- [ ] Admin routes require authentication (G4)
- [ ] Multi-signal locators enforced (G13)

### Feature Gaps (P1)
- [ ] slug/id alignment between frontend and worker (G2)
- [ ] Signed download route implemented (G3)
- [ ] Reader UI wired to backend (G1)
- [ ] Admin UI complete (G6)

### Code Quality (P1)
- [ ] ReaderPage.tsx split into components (CQ-1)
- [ ] GrantsPage.tsx split into components (CQ-2)

### Testing (P2)
- [ ] CFI navigation tests added (T-1)
- [ ] Password hashing tests added (T-3)
- [ ] Bookmark CRUD tests added (T-4)

### Documentation (P2)
- [ ] Setup documentation added (G7)

---

## References

- SWARM_ANALYSIS.md - Previous gap analysis
- plans/007-implementation-phases.md - Current implementation status
- plans/010-optimization-quality-backlog.md - Quality improvements
- plans/011-coding-workflow-improvements.md - Workflow enhancements
- analysis/ - Analysis reports

---

## Skills Used in This Analysis

- `security-code-auditor` - Security vulnerability assessment
- `code-quality` - Code quality and linting analysis
- `testing-strategy` - Test coverage evaluation
- `epub-rendering-and-cfi` - EPUB rendering context
