# ADR 998 — Offline Comment Status Preservation Policy

**Status:** Accepted
**Date:** 2026-07-15
**Decision Makers:** Autopilot (PR #795/#796 review follow-up)

## Context

PRs #795 and #796 extracted the data loading logic from ReaderPage.tsx
into `useReaderDataLoader` and `mapOfflineAnnotation`. The review
identified that `mapOfflineComment` hardcodes `status: 'open'` and
`visibility: 'shared'` for all offline-restored comments.

Investigation revealed:

1. The `AnnotationEntry` IndexedDB schema only stores creation-time
   data — it has no `status` or `visibility` fields.
2. Only newly-created annotations are cached offline via `saveAnnotation`.
3. Comment status mutations (resolve/unresolve) call the server API
   and update Zustand, but do not write to IndexedDB.
4. The hardcoded defaults are correct for newly-created comments
   (which are always open and shared).

## Decision

The mapper defaults are **intentionally correct** for the current data
model. The gap is not in the mapper but in the offline mutation pipeline:

- `handleResolveComment` does not persist status changes to IndexedDB
- The sync queue does not carry resolve/unresolve mutations
- The `AnnotationEntry` schema needs `status` and `visibility` fields

This is tracked as GOAP 998. The mapper includes an inline comment
(see `mapOfflineAnnotation.ts:18-21`) referencing this plan.

## Consequences

- **Short-term:** Offline-restored comments always show as 'open'.
  This is acceptable because only new comments are cached, and the
  server is the source of truth for status when online.
- **Long-term:** GOAP 998 will extend the offline schema and mutation
  handlers to persist comment status changes. Once complete, the mapper
  will use stored values with 'open'/'shared' as fallbacks for legacy
  entries.

## References

- GOAP 998: `plans/998-goap-offline-comment-status-mutations.md`
- A6 (resolved): Offline annotation restore from IndexedDB
- PR #795: Original hook extraction
- PR #796: Mapper extraction + hook tests
