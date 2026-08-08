# Plan 197: GOAP — Close Stale Plans & Add Missing Storybook Stories

**Status:** ✅ COMPLETED (merged via PR #816)
**Date:** 2026-07-18
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Strategy:** Swarm — independent tasks executed in parallel

## Goal

Close stale GOAP plans (063, 105, 106, 107, 110, 129, 178) that claim items
as "OPEN" when codebase verification proves they are already implemented.
Add missing Storybook stories for 5 newer UI components.

## Codebase Verification (2026-07-18)

Plans 105, 106, 107, and 110 were last verified on 2026-06-24. Since then,
significant implementation work has landed via PRs #754–#814.

### Items Verified as NOW DONE (plans claim OPEN)

| Plan ID | Finding | Evidence |
|---------|---------|----------|
| V1 (110) | Grant PATCH revokes sessions | `grants.ts:103-113` — transaction includes `reader_sessions` UPDATE |
| V2 (110) | `/admin/recover` route exists | `AdminRecoverPage.tsx` + `App.tsx:133` |
| V3 (110) | Offline bookmark routes correctly | `sync.ts:203-204` — `/api/books/:id/bookmarks` |
| V4 (110) | First-class queue types | `sync.ts:60` — bookmark and reading-insight types |
| V6 (110) | UI components exist | Pagination, ConfirmDialog, SearchInput, ProgressBar, Tabs in `packages/ui/src/` |
| V8 (110) | Container queries used | `CatalogPage.tsx:94` — `@container` class |
| V9 (110) | Native popover | `AnnotationToolbar.tsx:32-33` — feature detection + native popover |
| V10 (110) | React 19 patterns | `useOptimistic` in reader hooks, `useFormStatus`/`useActionState` in LoginPage |
| V11 (110) | Export/import notes | `useExportNotes.ts` + `useImportNotes.ts` + `export-notes-markdown.ts` |
| V12 (110) | Upload buffering | `books.ts` upload handling improved |
| F1 (063) | 404 catch-all route | `App.tsx` has `<Route path="*">` |
| F7 (063) | Chapter progress indicator | `ReaderToolbar.tsx` — chapter progress in toolbar |
| N1 (063) | Skip-to-content link | Present in `AppShell.tsx` |
| N2 (063) | Breadcrumbs | `Breadcrumb.tsx` + i18n keys in 13 locales (Plan 196) |
| D1-D5 (063) | Documentation | `docs/accessibility.md`, `docs/api.md`, `docs/setup-cloudflare.md`, `docs/setup-turso.md` (Plan 193) |
| C3 (063) | Touch targets | `.touch-target` class applied (Plan 196) |
| C4 (063) | useReducedMotion | Hook + utility created (Plan 196) |

### Remaining Gaps (still actionable)

| ID | Finding | Effort |
|----|---------|--------|
| S1 | Missing Storybook stories for Pagination, ConfirmDialog, SearchInput, ProgressBar, Tabs | S |
| S2 | Scroll-driven progress bar not implemented (no `animation-timeline`) | S |
| V5 | Typed errors unused in worker routes; no log-redaction layer | L |
| V13 | ReDoS policy + HSTS gaps on static responses | M |

## Tasks

### T1: Create Storybook stories for Pagination (P1)
- Follow Button.stories.tsx pattern
- Test single page, multi-page, ellipsis, edge cases

### T2: Create Storybook stories for ConfirmDialog (P1)
- Default, danger variant, with custom message

### T3: Create Storybook stories for SearchInput (P1)
- Default, with placeholder, disabled

### T4: Create Storybook stories for ProgressBar (P1)
- 0%, 50%, 100%, with label, with showValue

### T5: Create Storybook stories for Tabs (P1)
- Two tabs, three tabs, default active

### T6: Update stale plan statuses (P1)
- Mark plans 063, 105, 106, 107, 110, 129, 178 as COMPLETED or CLOSED

## Acceptance Criteria

- [x] 5 Storybook stories created for Pagination, ConfirmDialog, SearchInput, ProgressBar, Tabs
- [x] Stale plans updated with completion status and evidence
- [x] `pnpm build:storybook` passes
- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes (7/7)
- [x] `pnpm test:unit` passes
- [x] `pnpm build` passes

## Execution Strategy

**Swarm** — all 6 tasks are independent and executed in parallel.

| Task | Agent Type | Dependencies |
|------|-----------|-------------|
| T1-T5 | reader-ui-ux | None |
| T6 | goap-agent | None |
