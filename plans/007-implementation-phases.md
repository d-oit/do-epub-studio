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

### In Progress
- [ ] Reader annotation anchor engine (ADR-006)

### Blockers (G2, G3, G4)
- [ ] Fix slug/id mismatch in frontend/worker (G2) - CRITICAL
- [ ] Implement signed download route (G3) - HIGH
- [ ] Add admin auth middleware to admin routes (G4) - CRITICAL

### Code Quality Issues
- [ ] Refactor ReaderPage.tsx (1123 LOC, exceeds 500 limit) - CQ-1
- [ ] Refactor GrantsPage.tsx (740 LOC, exceeds 500 limit) - CQ-2

### Testing Gaps
- [ ] Add CFI navigation tests (T-1)
- [ ] Add EPUB parsing tests (T-2)
- [ ] Add password hashing tests (T-3)
- [ ] Add bookmark CRUD tests (T-4)

---

## Phase 2: Reader Enablement (Priority)

See Plan 012 for detailed gap analysis:
- G1: Wire Reader UI to EPUB.js backend
- G2: Fix slug/id mismatch
- G3: Implement signed download route
- G13: Enforce multi-signal annotation locators

---

## Phase 3: Admin Security (Priority)

- G4: Add admin authentication to all admin routes
- G6: Complete Admin UI workflow

---

## Phase 4: Testing & Quality

- T-1 through T-4: Expand test coverage
- CQ-1, CQ-2: Refactor oversized files
- G7: Add missing documentation
