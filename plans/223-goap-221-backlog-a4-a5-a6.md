# GOAP 223: Implement 221 Backlog Items — A4, A5, A6

**Date:** 2026-08-09
**Status:** IN REVIEW (PR #941)
**Goal:** Implement the three deferred backlog items from Plan 221 (A4, A5, A6):
centralized keyboard shortcuts, page-level skeleton screens, admin reading-insights
aggregation, and mark the OTel evaluation as satisfied by ADR-217.
**Related:** Plan 221, ADR-102b, ADR-217, ADR-212

## 1. Analysis

### 221-A4 — UI polish: skeletons + centralized keyboard shortcuts

Current state:
- `PageLoadingFallback` (spinner-only) used at app level in `App.tsx`; a
  glassmorphism spinner inlined in `App.tsx`'s `LoadingFallback` serves lazy routes.
- `AuditLogPage` already has a `<AuditSkeleton />` local component.
- `GrantsPage` has a local skeleton-style fallback in `Suspense`.
- 10+ components each add/remove their own `window.addEventListener('keydown', ...)`
  for Escape handling — no shared abstraction.

Plan:
- **Keyboard shortcuts:** Create `apps/web/src/hooks/useKeyboardShortcut.ts` — a
  small `useEffect`-based hook that registers a single document-level listener per
  shortcut key, with mod-key support. Each component that currently hard-codes
  its own `addEventListener('keydown', ...)` for Escape will be refactored to use
  this hook. The hook is scoped to a key + optional modifier array; multiple
  concurrent registrations are allowed (each component still owns its handler, but
  via the shared hook contract).
- **Skeletons:** Replace the spinner in `PageLoadingFallback` with a content-shaped
  skeleton (`animate-pulse` blocks) that matches the layout of each lazy-loaded page.
  Add page-specific skeleton variants:
  - `LibrarySkeleton` — card-grid skeleton for `MyLibraryPage`
  - `CatalogSkeleton` — card-grid skeleton for `CatalogPage`
  - `AdminSkeleton` — table-row skeleton for admin pages
  - `ReaderSkeleton` — full-screen reader skeleton
  App.tsx `LoadingFallback` uses `PageLoadingFallback`; route-specific Suspense
  boundaries use the appropriate named skeleton.

### 221-A5 — Admin reading-insights aggregation

Current state: `stats.ts` has book/grant/session counts but no reading data.
`insights.ts` is per-reader/per-book only.

Per ADR-102b §7: admin must show aggregate book-level or grant-level summaries;
must not expose individual reader behavior timelines.

Plan: Add `GET /admin/insights` to `apps/worker/src/routes/admin/insights.ts`:
- Aggregates `reading_insights` by `book_id` only — no `user_email` grouping.
- Returns: `bookId`, `totalActiveMinutes`, `totalActivePages`, `readerCount`
  (COUNT DISTINCT user_email — a count, not the emails), `lastActivity` (max bucket_date).
- Paginated: `?limit=20&offset=0`.
- Auth: `adminAuth` middleware only.
- Wire into `adminRouter` in `apps/worker/src/routes/admin/index.ts`.
- Add minimal unit test in `apps/worker/src/__tests__/routes.admin.test.ts`.

### 221-A6 — OTel evaluation writeup

ADR-217 (`plans/217-adr-opentelemetry-evaluation.md`) already IS the evaluation
writeup. It explicitly accepts-then-defers with named revisit criteria. The Plan 221
acceptance criterion says "accepted-risk ADR or evidence-based rejection" — ADR-217
satisfies this. Mark `[x]` in plan 221 with a note.

## 2. Decomposition

| Task | Scope | Files |
|------|-------|-------|
| T1 | Create `useKeyboardShortcut` hook | `apps/web/src/hooks/useKeyboardShortcut.ts` + test |
| T2 | Refactor Escape handlers in reader/panel components to use the hook | 8–10 component files |
| T3 | Create page-level skeleton components + update Suspense fallbacks | `apps/web/src/components/skeletons/*.tsx`, `App.tsx` |
| T4 | Admin insights aggregation endpoint + test | `apps/worker/src/routes/admin/insights.ts`, `index.ts`, test |
| T5 | Mark 221-A6 `[x]` in plan 221 | `plans/221-goap-remaining-audit-items.md` |

## 3. Strategy

Hybrid: T1 before T2 (T2 depends on T1); T3 and T4 are independent of T1/T2
and of each other (parallel). T5 is trivial — done in the docs commit.

Wave 1: T1 (keyboard hook)
Wave 2: T2 (refactor Escape handlers using T1), T3 (skeletons), T4 (admin insights) — parallel
Wave 3: Quality gate, T5 docs, commit + PR

## 4. Acceptance Criteria

- [ ] `useKeyboardShortcut(key, handler, { deps, condition })` hook exported from
      `apps/web/src/hooks/useKeyboardShortcut.ts`; unit-tested
- [ ] All 8+ scattered `addEventListener('keydown', ...)` Escape handlers replaced with
      the hook; no more raw window/document listeners for single-key shortcuts in
      components that don't need global control
- [ ] Page-level skeletons render content-shaped placeholders for Library, Catalog,
      Admin, and Reader route Suspense boundaries
- [ ] `GET /admin/insights` returns aggregated book-level reading data without
      exposing individual email; paginated; `adminAuth` required
- [ ] New worker route covered by a unit test; existing `routes.admin.test.ts` green
- [ ] 221-A6 marked `[x]` in plan 221 with ADR-217 reference
- [ ] `./scripts/quality_gate.sh` passes
- [ ] Coverage thresholds maintained (web ≥55% lines/48% funcs; worker ≥55%/50%)
- [ ] One PR, atomic commits, PR template + AI verification section
