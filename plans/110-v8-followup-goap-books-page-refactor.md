# GOAP 110-V8-followup — Refactor admin BooksPage.tsx below 500 LOC

**Date:** 2026-06-25
**Status:** ✅ COMPLETED (BooksPage is 423 LOC — under 500 limit)
**Parent:** plan 110-V8 (container queries)
**Trigger:** AGENTS.md TIER-1 "fix pre-existing issues" — `BooksPage.tsx` is 541 LOC (limit 500) and was touched in the V8 PR.

## Why

V8 refactored `BooksPage.tsx` to add the `cq cq--admin-books-grid` named container on its grid. While editing, the file was re-verified at 541 LOC — over the AGENTS.md `MAX_LINES_PER_SOURCE_FILE=500` cap. The overage pre-existed V8 but the file was touched, so the policy requires either an in-PR fix or a follow-up.

## Decompose

1. Extract the Create/Edit modal forms into `apps/web/src/features/admin/components/BookFormModal.tsx` (~200 LOC).
2. Extract the inline API helpers (slug derivation, `validateEpubLocal`) into `apps/web/src/features/admin/lib/bookMutations.ts` (~60 LOC).
3. Extract the book card markup into `apps/web/src/features/admin/components/BookCard.tsx` (~60 LOC).
4. Result: `BooksPage.tsx` drops below 250 LOC; new files stay under their own 500 LOC cap.

## Acceptance

- `pnpm --filter @do-epub-studio/web typecheck && lint && test:unit` all green.
- Coverage delta for `BooksPage.tsx` not regressing.
- New modal/card components have their own test files mirroring the existing `BooksPage.test.tsx` cases that target that surface.

## ADR

See `plans/110-v8-followup-adr-books-page-refactor.md` (TO WRITE in this PR).

## Tracking issue

GitHub issue to be filed with label `refactor` and linked from V8 PR description.
