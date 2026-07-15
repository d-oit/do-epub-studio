# GOAP 998 — Offline Comment Status Mutation Persistence

**Status:** OPEN
**Created:** 2026-07-15
**Priority:** P2 (Medium)
**Category:** Offline / Reader

## Problem

Comment status mutations (resolve/unresolve) while offline are not persisted
to IndexedDB. When the user:

1. Creates a comment while offline → cached in IndexedDB (status not stored)
2. Resolves the comment while offline → only updated in Zustand store
3. Refreshes the page (server unavailable) → restored comment shows as 'open'

The `AnnotationEntry` schema lacks `status` and `visibility` fields because
only newly-created annotations are cached. The `handleResolveComment` handler
in `useAnnotationHandlers.ts` calls the server API and updates the Zustand
store, but does not write to IndexedDB.

## Root Cause

- `AnnotationEntry` (apps/web/src/lib/offline/db.ts:15) has no
  `status` or `visibility` field.
- `saveAnnotation` is only called on creation (offline create path),
  not on mutation (resolve, edit, delete).
- `handleResolveComment` (useAnnotationHandlers.ts:161) does not
  check `navigator.onLine` or queue an offline mutation.

## Scope

1. Extend `AnnotationEntry` with optional `status` and `visibility`
   fields (IndexedDB schema migration).
2. Update `saveAnnotation` callers to include status when caching
   resolved comments.
3. Add offline-aware resolve handler: when offline, update IndexedDB
   and queue a sync mutation for resolve/unresolve.
4. Update `mapOfflineComment` to use the stored status/visibility
   when available, falling back to 'open'/'shared' for legacy entries.
5. Add tests for offline resolve → refresh → restore cycle.

## Dependencies

- Requires IndexedDB schema migration (version bump in db.ts)
- Sync queue already supports annotation type (plan 121 / PR #757)

## Files Affected

- `apps/web/src/lib/offline/db.ts` — schema migration
- `apps/web/src/features/reader/hooks/useAnnotationHandlers.ts` — offline resolve
- `apps/web/src/features/reader/hooks/mapOfflineAnnotation.ts` — use stored status
- `apps/web/src/__tests__/offline-restore.test.ts` — new test cases

## Acceptance Criteria

- [ ] Resolving a comment while offline persists the status to IndexedDB
- [ ] After refresh (offline), resolved comments restore with correct status
- [ ] Sync queue processes pending resolve mutations when back online
- [ ] All existing offline restore tests pass
- [ ] New tests cover: create → resolve → refresh → verify status
