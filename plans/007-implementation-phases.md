# Phase 1: Core Infrastructure & P0 Features

## See Also
- **Plan 011**: Coding Workflow Improvements — AGENTS.md compliance, security scripts, quality gate enhancements
- **Plan 012**: Comprehensive Analysis Findings — Security audit, code quality, testing gaps

### Completed
- [x] Initial monorepo setup (Vite, PWA, Worker)
- [x] Turso / libSQL schema & migrations
- [x] EPUB.js basic integration
- [x] Global error interceptors for 401/403 responses
- [x] Unskip and fix Admin/Reader unit tests
- [x] Argon2id password hashing (G5 - RESOLVED)
- [x] Fix slug/id mismatch in frontend/worker (G2) - books.ts resolves both id and slug
- [x] Implement signed download route (G3) - files.ts verifies expiry + HMAC signature
- [x] Add admin auth middleware to all admin routes (G4) - requireAdminAuth in index.ts
- [x] Refactor ReaderPage.tsx (492 LOC — CQ-1 RESOLVED)
- [x] Refactor GrantsPage.tsx (311 LOC — CQ-2 RESOLVED)
- [x] Add password hashing tests (T-3 RESOLVED)
- [x] Add bookmark CRUD tests (T-4 RESOLVED)
- [x] Fix memory leaks in sync.ts and db.ts
- [x] Add traceId telemetry to sync.ts and sw.ts
- [x] Consolidate telemetry.ts to use @do-epub-studio/shared

### In Progress
- [ ] Reader annotation anchor engine (ADR-006) / multi-signal locators (G13)
- [ ] G1: Wire Reader UI fully to EPUB.js backend (progress sync wired, full CFI navigation)

### Remaining Testing Gaps
- [ ] Add CFI navigation tests (T-1) — reader-core locator.test.ts partially covers this
- [ ] Add EPUB parsing tests (T-2) — needs epub fixture files

---

## Phase 2: Reader Enablement

See Plan 012 for detailed gap analysis:
- [x] G2: Fix slug/id mismatch — RESOLVED
- [x] G3: Implement signed download route — RESOLVED
- [ ] G1: Wire Reader UI fully to EPUB.js backend
- [ ] G13: Enforce multi-signal annotation locators (AGENTS.md ADR-006)

---

## Phase 3: Admin Security

- [x] G4: Add admin authentication to all admin routes — RESOLVED
- [ ] G6: Complete Admin UI workflow (BooksPage create flow, grant wizard)

---

## Phase 4: Testing & Quality

- [x] T-3: Password hashing tests — RESOLVED
- [x] T-4: Bookmark CRUD tests — RESOLVED
- [x] CQ-1: Refactor ReaderPage.tsx (492 LOC) — RESOLVED
- [x] CQ-2: Refactor GrantsPage.tsx (311 LOC) — RESOLVED
- [ ] T-1: CFI navigation tests — partial (locator.test.ts covers createLocator/parseLocator)
- [ ] T-2: EPUB parsing tests — open
- [ ] G7: Add missing setup documentation
