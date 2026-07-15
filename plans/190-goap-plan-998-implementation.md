# Plan 190: GOAP Session — Plan 998 Offline Comment Status Implementation

**Status:** ✅ COMPLETED
**Date:** 2026-07-15
**Branch:** `feat/plan-998-offline-comment-status`
**Strategy:** Swarm — T1 (schema) first, then T2 + T3 parallel, T4 (tests) after

## Goal

Implement Plan 998: persist comment status mutations (resolve/unresolve) to IndexedDB
when offline so they survive page refresh and sync when back online.

## Tasks Completed

| Task | File(s) | Description | Status |
|------|---------|-------------|--------|
| T1 | `db.ts` | Extend `AnnotationEntry` with `status?` and `visibility?`; bump `DB_VERSION` to 2 with versioned upgrade handler | ✅ |
| T2 | `useAnnotationHandlers.ts`, `useReaderHandlers.ts` | Add offline-aware `handleResolveComment`: when offline, update IndexedDB + queue sync mutation | ✅ |
| T3 | `mapOfflineAnnotation.ts` | Use stored `status`/`visibility` from `AnnotationEntry`, fall back to `'open'`/`'shared'` for legacy entries | ✅ |
| T4 | `mapOfflineAnnotation.test.ts`, `offline-restore.test.ts`, `offline-db.test.ts` | Add tests for resolved status mapping, legacy fallback, offline resolve cycle, DB round-trip | ✅ |
| T5 | `998-goap-offline-comment-status-mutations.md` | Update plan status and acceptance criteria | ✅ |

## Verification

- `pnpm lint` — ✅ passes (10 workflows validated)
- `pnpm typecheck` — ✅ passes (7/7 packages)
- `pnpm build` — ✅ passes
- `pnpm test:unit` (web) — ✅ 847 tests pass across 73 files
- `pnpm test:unit` (worker) — ✅ 241 tests pass
- `pnpm test:unit` (reader-core) — ✅ 288 tests pass
- `pnpm test:unit` (shared) — ✅ 120 tests pass
- Commit validator parity — ✅ 28/28 pass, 0 drift

## Files Modified

| File | Change |
|------|--------|
| `apps/web/src/lib/offline/db.ts` | Add `status?`, `visibility?` to `AnnotationEntry`; bump `DB_VERSION` 1→2; versioned upgrade handler |
| `apps/web/src/features/reader/hooks/useAnnotationHandlers.ts` | Offline-aware `handleResolveComment` |
| `apps/web/src/features/reader/hooks/useReaderHandlers.ts` | Offline-aware `handleResolveComment` |
| `apps/web/src/features/reader/hooks/mapOfflineAnnotation.ts` | Use stored status/visibility with fallback |
| `apps/web/src/features/reader/hooks/mapOfflineAnnotation.test.ts` | 3 new tests for status/visibility mapping |
| `apps/web/src/__tests__/offline-restore.test.ts` | 1 new test for offline resolve cycle |
| `apps/web/src/__tests__/offline-db.test.ts` | 3 new tests for status/visibility DB operations |
| `plans/998-goap-offline-comment-status-mutations.md` | Status update |
| `plans/190-goap-plan-998-implementation.md` | This plan |
