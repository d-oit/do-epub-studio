# offline-data-integrity — Repo Guide

## IDB module (`apps/web/src/lib/offline/db.ts`)

- Library: `idb`; `DB_NAME = 'do-epub-studio'`; `DB_VERSION = 5` (current).
- Migration pattern: `upgrade(db, oldVersion)` with per-version cases creating stores: `progress`, `annotations`, `syncQueue`, `permissions`, `readingInsights`, `conflicts`, `feedbackDrafts`, `bookFiles`.
- Sensitive entries are encrypted via `encryptJSON`/`decryptJSON` (`./crypto`).
- Session safety: `captureSessionToken()` before the await; `assertSessionToken(expected)` immediately before the IDB write (S1/GOAP-1002) — 401 on expiry.

## Sync modules (`apps/web/src/lib/offline/`)

- `sync.ts`, `sync-item.ts`, `sync-order.ts`, `sync-policy.ts`, `sync-canonical-entry.ts`, `annotation-sync.ts`, `feedback-sync.ts`, `conflict-resolution.ts`, `progress-conflict.ts`, `auth-loss-cleanup.ts`.
- Sync queue entries are keyed by id; retry preserves intent; conflicts resolved per `conflict-resolution.ts` policy; permission revocation triggers cleanup (`auth-loss-cleanup.ts`).
- Docs: `docs/offline.md` (ADR-005) covers dual-cache architecture, IDB stores, sync protocol, retry logic, conflict resolution, permission revocation detection, service-worker lifecycle, background sync, cache invalidation, online listener.

## Quota

- `apps/web/src/components/StorageQuota.tsx` surfaces usage; `data-cache.ts` + `prefetch-manager.ts` manage cached content. Use `navigator.storage.estimate()` and handle `QuotaExceededError` with eviction/retry.

## Tests

```bash
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/web exec vitest run src/lib/offline
```

Relevant files: `sync.test.ts`, `annotation-sync.test.ts`, `feedback-sync.test.ts`, `conflict-resolution.test.ts`, `reading-insights.test.ts`, `session.test.ts`, `feedback-drafts.test.ts`, `progress-conflict.test.ts`.
