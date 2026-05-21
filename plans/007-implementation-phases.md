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
(none — all sprint items complete)

### Completed Sprint #140 Items
- [x] Multi-signal locators enforced (G13) — ProgressUpdateSchema + BookmarkCreateSchema use MultiSignalLocatorSchema
- [x] Reader annotation anchor engine (ADR-006) — epub-loader exposes hooks + typed Contents for injection
- [x] G1: ReaderPage progress hydration, offline fallback, annotation restore on displayed events
- [x] Keyboard navigation in ReaderPage (arrow keys)
- [x] epub-loader unit tests (233 lines, full coverage)
- [x] E2E smoke test for reader migration
- [x] Offline reader E2E test
- [x] fast-check property tests (shared + reader-core)
- [x] Telemetry dedup across all packages
- [x] Memory leak fixes (toast, global handler, sync retry, db close)
- [x] Session expiry audit + tests
- [x] Rate limiter documentation
- [x] Documentation (architecture.md, security.md, offline.md, reader-rendering.md runbook)
- [x] Dependency audit + Lighthouse documentation

### Completed (Sprint Completion Swarm)
- [x] Add EPUB parsing tests (T-2) — 21 tests with in-memory EPUB fixture files
- [x] Move shared UI components to packages/ui (#140 §7.2) — 11 components migrated, apps/web/index.tsx 615→31 LOC
- [x] ESLint 10 migration (#140 §7.1) — eslint ^9→^10.3.0, @eslint/js ^9→^10.0.1

---

## Phase 2: Reader Enablement

See Plan 012 for detailed gap analysis:
- [x] G2: Fix slug/id mismatch — RESOLVED
- [x] G3: Implement signed download route — RESOLVED
- [x] G1: Wire Reader UI fully to EPUB.js backend — RESOLVED
- [x] G13: Enforce multi-signal annotation locators (AGENTS.md ADR-006) — RESOLVED

---

## Phase 3: Admin Security

- [x] G4: Add admin authentication to all admin routes — RESOLVED
- [x] G6: Complete Admin UI workflow (BooksPage create flow, grant wizard) — RESOLVED

---

## Phase 4: Testing & Quality

- [x] T-3: Password hashing tests — RESOLVED
- [x] T-4: Bookmark CRUD tests — RESOLVED
- [x] CQ-1: Refactor ReaderPage.tsx (492 LOC) — RESOLVED
- [x] CQ-2: Refactor GrantsPage.tsx (311 LOC) — RESOLVED
- [x] T-1: CFI navigation tests — 68 tests total (was 39), with fast-check property tests
- [x] T-2: EPUB parsing tests — 21 tests with in-memory ZIP fixture builder
- [x] G7: Add missing setup documentation — docs verified/updated (setup-local.md, README.md)

---

## Phase 8: Post-0.1.0 Backlog Triage (active)

All open GitHub issues (17) and PRs (4) as of 2026-05-19 are coordinated through:

- **Plan 038** — GOAP backlog triage (waves W1 PR reconciliation + release cut, W2 swarm across CI/UI/Docs/Testing groups, W3 cleanup)
- **ADR 039** — Issue & PR triage policy

Remaining product-code TODO inventory:

- [ ] `apps/worker/src/lib/rate-limiter.ts:35` — in-memory limiter → Durable Objects cutover (tracked under #140; carry-over from Sprint 141)
- [x] PR #215 — workflow cleanup: remove redundant .gemini/skills, fix .qwen/skills structure, add github-pr-autopilot skill
- [x] Plan 042 — GOAP Learnings Lifecycle
- [x] ADR 043 — Learnings Compaction Policy

No other phases are in progress. New work must be filed against Plan 038's waves or spawn a fresh triage plan per ADR 039.
