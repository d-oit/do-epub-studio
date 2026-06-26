# ADR-111: Cap-driven Refactor of `admin/BooksPage.tsx`

**Date:** 2026-06-25
**Status:** Proposed (follow-up to V8)
**Deciders:** Project maintainer
**Related:** ADR-052 (Gap Closure Policy), AGENTS.md TIER-1 (file-size cap = 500 LOC), plan 110-V8

## Context

While implementing V8 (container queries per ADR-105), `apps/web/src/features/admin/BooksPage.tsx` was touched to add the `cq cq--admin-books-grid` named container. The file is 541 LOC — over AGENTS.md `MAX_LINES_PER_SOURCE_FILE=500`. The overage pre-existed V8, but per AGENTS.md TIER-1 the issue must be fixed in the same PR or a follow-up GOAP + ADR + tracking issue must be created.

The overage is concentrated in two areas:

1. The inline create + edit `<Modal>` forms (~200 LOC duplicated form fields).
2. The book-card markup with action buttons (edit / archive / manage access) embedded in the page (~60 LOC).

## Decision

1. Extract the create/edit modal form into a new component `apps/web/src/features/admin/components/BookFormModal.tsx` (handles both `mode="create"` and `mode="edit"`).
2. Extract the book-card markup into `apps/web/src/features/admin/components/BookCard.tsx`.
3. Move validation/slug helpers into `apps/web/src/features/admin/lib/bookMutations.ts`.
4. Result: `BooksPage.tsx` ≤ 250 LOC, all extracted files under their own 500 LOC cap.

## Consequences

### Positive

- V8 PR remains scoped; no mega-PR bundling unrelated refactors.
- File-size cap policy is honored via documented follow-up.
- Reusable `BookFormModal` can be reused by other admin flows (clone, bulk import, etc.).

### Negative / costs

- One extra round of code review + tests for the new components.
- BookmarksPanel-style test file split (current `BooksPage.test.tsx` covers all surfaces; new tests will mirror the splits).

## Compliance

- AGENTS.md TIER-1 — issue fixed in the same PR OR follow-up GOAP + ADR + tracking issue. **This ADR is the follow-up.**
- AGENTS.md TIER-3 — max 500 LOC per source file (after refactor).
- ADR-083 numbering — `111` is the next free number after `110` and the existing `110-adr-*` follow-ups.
