# GOAP Plan 078: Sprint D Feature Delivery and Quality Improvements

**Date**: 2026-06-11
**Orchestrator**: goap-agent
**Branch**: `feat/sprint-d-missing-implementations`

## 1. Analysis (World State)

- CI: ✅ green (core gates pass)
- Open PRs: 0
- Open Issues: 0
- Plan 077 Sprint D partially deferred — this plan completes actionable items
- Items already resolved by prior PRs: z.any() fix, O(n²) comment rebuild, progress bar

## 2. Goals (Decompose)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Fix `z.any()` in UploadCompleteSchema | ✅ Already done | Proper schema in admin/books.ts |
| 2 | Fix comment store O(n²) nesting | ✅ Already done | Map-based O(n) `rebuildTree` |
| 3 | Add `useShallow` to reader hooks | ✅ Implemented | 3 hooks updated |
| 4 | Public book catalog route + page | ✅ Implemented | Worker + Web |
| 5 | Reading progress bar in toolbar | ✅ Already done | Inline + full-width bar |

## 3. Actions Taken

### useShallow optimization (P3 quality)

Applied `useShallow` from `zustand/react/shallow` to data selectors in:
- `useExportNotes.ts` — grouped highlights + comments into single shallow selector
- `useAnnotationHandlers.ts` — comments array via useShallow
- `useReaderHandlers.ts` — comments array via useShallow

Benefit: prevents unnecessary re-renders when unrelated store slices change.

### Public book catalog (P2 feature)

- **Worker**: `GET /api/catalog` endpoint (no auth) returning books with `visibility='public'`
- **Web**: `/catalog` route with lazy-loaded `CatalogPage` component
  - Responsive grid (1/2/3 columns)
  - Loading skeletons, error state, empty state
  - Links to login with book slug pre-filled
  - Uses semantic design tokens per ADR-063

## 4. Deferred Items (Require External Dependencies)

| # | Feature | Blocker |
|---|---------|---------|
| 1 | Email invite dispatch | CF SendEmail binding not configured |
| 2 | In-book full-text search | Needs search index infrastructure |
| 3 | Reviewer activity dashboard | New admin route (low priority) |

## 5. Quality Gates

- [x] Web typecheck passes
- [x] Worker typecheck passes
- [x] Lint passes
- [x] No source file exceeds 500 LOC
- [x] Codacy Static Code Analysis passes (0 new issues)
- [x] All CI checks green on PR #479

## 6. CI Fix: Codacy Findings (7 → 0)

| Issue | Fix |
|-------|-----|
| Array index as key (skeleton loader) | Use stable string keys `sk-1`..`sk-6` |
| Missing img width/height | Added `width={320} height={160}` |
| Don't use `<img>` element | Wrapped in `<picture>` element |
| 4× unnecessary `??` conditional | Cast to `string \| null` instead of `string` |
| Invalid eslint-disable comment | Removed non-existent rule reference |

## 7. References

- Parent plan: 077-goap-comprehensive-analysis-2026-06-11.md
- ADR: 077-adr-phased-feature-delivery.md
