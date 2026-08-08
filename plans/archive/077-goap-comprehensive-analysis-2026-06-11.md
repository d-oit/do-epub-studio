# GOAP Plan 077: Comprehensive Codebase Analysis

**Date**: 2026-06-11
**Orchestrator**: goap-agent
**Purpose**: Document missing implementations, stubs, improvements, and new feature opportunities.

## 1. World State (Analyze)

- CI core: ✅ green (typecheck, lint, unit tests, build, benchmark)
- Scheduled E2E: ❌ fail (non-blocking, tracked in plan 074)
- Open PRs: 0
- Open Issues: 9 (8 closeable per plan 075)
- Last plan: 076 (project health summary)
- No actionable TODO/FIXME/HACK in application source code

## 2. Goals (Decompose)

### G1: Complete Missing Implementations (9 items)

| # | Feature | Location | Priority |
|---|---------|----------|----------|
| 1 | Email invite sending | `worker/routes/admin/grants.ts` | P1 |
| 2 | Bookmark sync from server on load | `web/features/reader/ReaderPage.tsx` | P1 |
| 3 | In-book full-text search | Missing from reader entirely | P2 |
| 4 | Public book catalog | Missing route + page | P2 |
| 5 | Reviewer activity dashboard | Missing admin page | P2 |
| 6 | Threaded comments resolution UI | `CommentsPanel.tsx` (basic) | P3 |
| 7 | Compare editions | Not present | P3 |
| 8 | Versioned manuscript releases | Schema lacks version fields | P3 |
| 9 | AI editorial workflows | Not present | P4 |

### G2: Fix Stubs/Incomplete Code (6 items)

| # | Issue | Location | Priority |
|---|-------|----------|----------|
| 1 | `SignedUrlResponse` DTO mismatch | `worker/routes/books.ts` vs `shared/dtos.ts` | P1 |
| 2 | `Locator` schema vs store type mismatch | `schema/locator.ts` vs `stores/reader.ts` | P1 |
| 3 | API index re-export bare minimum | `web/lib/api/index.ts` | P2 |
| 4 | Admin books page missing archive/delete | `BooksPage.tsx` | P2 |
| 5 | Fixed layout rendering minimal | `reader-core/fixed-layout.ts` | P3 |
| 6 | Missing bookmark API test | `worker/routes/reader/` | P2 |

### G3: Apply Improvements (10 items)

| # | Category | Issue | Priority |
|---|----------|-------|----------|
| 1 | Security | Grant revocation needs transaction | P0 |
| 2 | Security | Missing PATCH validation on highlight ownership (cross-book) | P0 |
| 3 | Security | Rate limit on admin login | P1 |
| 4 | Quality | `BooksPage.tsx` exceeds 500 LOC | P1 |
| 5 | Quality | `useReaderEpub.ts` exceeds 500 LOC (18KB) | P1 |
| 6 | Quality | `ReaderToolbar.tsx` exceeds 500 LOC (18KB) | P1 |
| 7 | Performance | Comment store O(n²) nesting rebuild | P2 |
| 8 | Quality | `z.any()` in `UploadCompleteSchema` | P2 |
| 9 | Quality | `AuditLogPage.tsx` missing aria-labels | P0 (plan 074) |
| 10 | Quality | Grouped `useReaderStore` selectors with `useShallow` | P3 |

### G4: New Features (backlog)

| # | Feature | Effort | Value |
|---|---------|--------|-------|
| 1 | In-book full-text search | M | High |
| 2 | Email notifications (CF Email Workers) | S | High |
| 3 | Public book catalog | S | Medium |
| 4 | Admin dashboard analytics | M | Medium |
| 5 | Reading progress bar | S | Medium |
| 6 | Export annotations as PDF/DOCX | M | Medium |
| 7 | Multi-user highlight visibility | M | Medium |
| 8 | Book archive/delete admin UI | S | Low |
| 9 | Session expiry warning | S | Low |
| 10 | Batch grant operations (CSV import) | S | Low |

## 3. Action Plan (Strategize)

### Sprint A: Security & Compliance (P0) ✅ Complete (PR #476)

1. ~~Wrap grant revocation in D1 transaction (`worker/routes/admin/grants.ts`)~~
2. ~~Validate highlight `book_id` matches route param on PATCH (`worker/routes/reader/highlights.ts`)~~
3. ~~Fix `AuditLogPage.tsx` aria-labels (tracked in plan 074)~~ — already fixed upstream

### Sprint B: Code Quality (P1) ✅ Complete (PR #477)

4. ~~Split `useReaderEpub.ts` into `useEpubLoader`, `useEpubNavigation`, `useEpubRendition`~~ — extracted progress logic to `useEpubProgress.ts` (523→431 LOC)
5. ~~Split `ReaderToolbar.tsx` into sub-components per toolbar section~~ — already under 500 LOC (396)
6. ~~Split `BooksPage.tsx` into `BookList`, `BookCreateForm`, `BookCard`~~ — already under 500 LOC (384)
7. ~~Add rate-limit middleware to admin login endpoint~~ — already implemented (5 req/min per email)
8. ~~Fix `SignedUrlResponse` DTO — return all fields from endpoint~~

### Sprint C: Missing Implementations (P1-P2) ✅ Complete (PR #477 + PR #478)

9. Implement email invite dispatch using CF SendEmail binding — deferred (requires CF binding)
10. ~~Fetch bookmarks from API on ReaderPage mount~~
11. ~~Unify `Locator` types between schema and store~~
12. ~~Add bookmark CRUD tests for worker~~

### Sprint D: Features (P2+) — Partial

13. Public catalog route + page — deferred (new route)
14. In-book full-text search (CFI-based result navigation) — deferred (needs search index infra)
15. Reviewer activity dashboard — deferred (new route)
16. ~~Reading progress bar in toolbar~~

## 4. Dependencies (Coordinate)

```
Sprint A → Sprint B → Sprint C → Sprint D
         ↘ Plan 074 (E2E fix) → Sprint B completes accessibility
```

- Sprint A has no external dependencies (pure backend fixes)
- Sprint B #8 depends on Sprint A #1 completing (grants code changes)
- Sprint C #9 requires CF Email Workers binding configured in `wrangler.toml`
- Sprint D #14 requires reader-core search index infrastructure

## 5. Success Criteria (Execute/Synthesize)

- [x] All P0 security items resolved (PR #476 — 2026-06-11)
- [x] No source file exceeds 500 LOC (PR #477 — 2026-06-11)
- [x] `SignedUrlResponse` DTO matches actual endpoint response (PR #477)
- [x] Bookmark sync works on reader page load (PR #478 — 2026-06-11)
- [x] Quality gate passes with no new warnings
- [x] ADR 077 documents the policy for phased feature delivery

## 6. References

- ADR: `plans/077-adr-phased-feature-delivery.md`
- Prior art: plan 066 (comprehensive analysis), plan 063 (audit)
- Coding guide: `docs/coding-guide.md` §3 (Later phases)
