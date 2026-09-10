---
version: "1.0.0"
name: pwa-offline-sync
description: >
  Design Cache Storage + IndexedDB strategy and sync queue per ADR-005.
  Activate for service worker, cache, or offline bug investigation.
category: workflow
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Skill: `pwa-offline-sync`

Purpose: design, implement, and validate offline/PWA behavior (service worker, caches, IndexedDB, sync queue) per ADR-005.

## When to run

- Editing service worker, cache strategies, or sync orchestration.
- Touching IndexedDB schema, permission caching, or zombie detection.
- Investigating offline bugs or data conflicts.

## Inputs

- `plans/005-adr-offline-sync.md`
- `plans/007-implementation-phases.md` (Phase 3)
- `docs/offline.md` (when available)

## Workflow

1. **Assess entity rules** – confirm table of offline-first entities + conflict strategy.
2. **Plan caches** – map shell/static/EPUB/cover assets to Cache Storage policies (cache-first vs stale-while-revalidate vs network-first).
3. **IndexedDB schema** – define stores for progress, annotations, sync queue, permission cache; version migrations carefully.
4. **Service worker** – implement install/activate/fetch with trace logging, offline fallback page, and error handling.
5. **Sync manager** – queue writes locally, dedupe via mutation IDs, replay when online, implement exponential backoff + zombie detection.
6. **Testing** – simulate offline/online in Playwright; unit-test queue reducers; verify revoked grants are blocked after reconnect.

## Checklist

- [ ] Cache + DB version numbers bumped intentionally (no silent clears).
- [ ] `Accept-Language`, `X-Trace-Id`, and capability headers sent even when offline data queued.
- [ ] Zombie detection notifies user + stops further reads upon revocation.
- [ ] Service worker cleans up old caches.
- [ ] Memory-safe listeners (remove event handlers on `self` when replaced).

## Examples

### Sync Pattern

Queue a write locally, then attempt sync with exponential backoff (from `apps/web/src/lib/offline/sync.ts`):

```ts
// Enqueue a progress update — persists to IndexedDB immediately
await queueSync('progress', {
  bookId, cfi, percentage, mutationId: generateMutationId(),
}, generateMutationId());

// attemptSync processes the queue item-by-item (oldest first):
//   success → remove item, mark local record synced
//   401/403 → clearAllPermissions(), invoke onPermissionRevoked callback (zombie detection)
//   other error → increment attempts, schedule retry with exponential backoff
//     delay = min(BASE_DELAY_MS * 2^attempt, MAX_DELAY_MS)  [1s → 30s cap]

// Tear down online/offline listeners and cancel pending retries on unmount:
const cleanup = setupOnlineListener();
return () => cleanup(); // also calls cancelPendingRetry()
```

### Auth-Gated Queue Reads (shell surfacing)

Sync-queue payloads are encrypted with the session token — an
unauthenticated poll is not just wasteful, it reads the wrong owner's data
path. Any hook that surfaces sync state app-wide (`useSyncStatus` mounted in
`App()`) MUST:

- Reset `pendingSyncCount` to 0 and skip IndexedDB entirely when logged out;
- Re-run the effect on the auth flip so the count refreshes on login and
  clears on logout;
- Keep the offline barrel (`lib/offline` — IndexedDB + crypto + sync) behind
  a **dynamic import** in shell-level hooks so it stays out of the eager
  bundle (ADR-107 §3 route totals); feature code inside the reader may import
  it statically;
- Mirror connectivity + count into `useReaderStore` so every route (not just
  the reader) renders offline/pending state; the reader route renders outside
  `AppShell`, so shell status elements don't duplicate the reader's own
  indicator.

Reuse the existing plural key (`offline.pendingSync` one/other) — never add a
second count key for the same noun.

### PWA Install Lifecycle (progressive enhancement)

Per web.dev customize-install / MDN `beforeinstallprompt`:

- `beforeinstallprompt`: always `preventDefault()` (suppress the mini-infobar),
  retain only the latest event, expose `canPrompt` unless already standalone;
- `promptInstall()` consumes the retained event **exactly once**, returns
  `'accepted' | 'dismissed' | 'unavailable'`, clears `canPrompt` before
  prompting; a later event re-arms;
- `isStandalone()` uses `display-mode` media queries + iOS
  `navigator.standalone` — no UA sniffing;
- Install UI renders **nothing** when unsupported/installed/dismissed — never
  a disabled button or fake prompt; dismissal is session-only in memory;
- Listeners wire in `main.tsx` inside the `typeof window` block before SW
  registration, cleanup retained in module scope for HMR/tests;
- Synthetic-event tests prove UI lifecycle only — never claim native OS
  installation from them.
