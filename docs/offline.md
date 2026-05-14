# Offline Architecture (ADR-005)

## Dual-Cache Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Cache Storage  │     │    IndexedDB    │
│  (App shell,     │     │  (Progress,     │
│   EPUB assets)   │     │   annotations,  │
│                  │     │   sync queue)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    ┌──────────────────┘
         │    │
         ▼    ▼
┌─────────────────────────────────┐
│         Sync Manager            │
│  (Queue, retry, conflict)       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│     Cloudflare Worker API       │
└─────────────────────────────────┘
```

## IndexedDB Stores

Database: `do-epub-studio` (version 1)

| Store | Key Path | Indexes | Purpose |
|-------|----------|---------|---------|
| `progress` | `id` | `bookId`, `synced` | Reading position per book |
| `annotations` | `id` | `bookId`, `synced` | Highlights, comments, bookmarks |
| `syncQueue` | `id` | `createdAt` | Outbound sync mutation queue |
| `permissions` | `bookId` | — | Cached grant info for offline access |

Schema defined in `apps/web/src/lib/offline/db.ts`:

```typescript
interface ProgressEntry {
  id: string; bookId: string; cfi: string;
  percentage: number; lastRead: number;
  synced: boolean; mutationId: string;
}

interface AnnotationEntry {
  id: string; bookId: string;
  type: 'highlight' | 'comment' | 'bookmark';
  cfi: string; endCfi?: string; text?: string;
  comment?: string; color?: string; chapter?: string;
  createdAt: number; synced: boolean; mutationId: string;
}

interface SyncQueueItem {
  id: string; type: 'progress' | 'annotation';
  payload: unknown; mutationId: string;
  createdAt: number; attempts: number;
  lastAttempt?: number; error?: string;
}

interface PermissionCache {
  bookId: string; grantId: string;
  canComment: boolean; canDownloadOffline: boolean;
  cachedAt: number; expiresAt: number;
}
```

## Sync Queue & Protocol

### Mutation Flow

```
Client write
  ↓
saveProgress/saveAnnotation (local IndexedDB, optimistic)
  ↓
queueSync(type, payload, mutationId)
  └→ addToSyncQueue(item)
  └→ attemptSync() (if online)
```

### Sync Protocol

1. Queue is FIFO (sorted by `createdAt`)
2. POST/PUT to Worker API with `mutationId` in body
3. Server uses mutationId for idempotency (UUID v7)
4. On success: remove from syncQueue, mark local entry as `synced: true`
5. On failure: increment `attempts`, schedule retry with exponential backoff

### Retry Logic

```typescript
BASE_DELAY_MS = 1000
MAX_DELAY_MS = 30000
MAX_RETRY_ATTEMPTS = 5
// delay = 1s, 2s, 4s, 8s, 16s (capped at 30s)
```

### Conflict Resolution

| Entity | Strategy |
|--------|----------|
| Progress | Last-write-wins (by `lastRead` timestamp) |
| Bookmarks | Last-write-wins |
| Highlights | Last-write-wins |
| Comments | Append-only (no overwrite) |

### Permission Revocation Detection

- `syncItem()` returns `permission_revoked` on 401/403 or `revoked`/`permission` in error message
- Clears all cached permissions in IndexedDB
- Calls `onPermissionRevoked` callback → UI shows access revoked message
- Failing sync item is removed from queue (prevents stall)

## Service Worker Lifecycle

File: `apps/web/src/sw.ts`

### Caching Strategy

| Content | Cache Name | Strategy | TTL |
|---------|-----------|----------|-----|
| App shell + assets | (precache) | `precacheAndRoute` (Workbox) | Permanent |
| Google Fonts stylesheets | `google-fonts-stylesheets` | CacheFirst | 1 year |
| Google Fonts webfonts | `google-fonts-webfonts` | CacheFirst | 1 year |
| Images | `images` | CacheFirst | 30 days |
| EPUB files (`/api/files/`) | `epub-files` | CacheFirst | 7 days |
| API responses (`/api/`) | `api-responses` | NetworkFirst | 15 min |

### Background Sync

Registered with tag `sync-reader-state`. On `sync` event:
1. Dynamically imports `syncAll()` from `./lib/offline/sync`
2. Processes queue FIFO
3. Logs traceId for every sync attempt (success/failure)

### Cache Invalidation

SW listens for `postMessage({type: 'CLEAR_CACHE', cacheName})`:
- Deletes named cache
- Logs result with traceId

### Online Listener

`setupOnlineListener()` in `sync.ts`:
- Adds `online`/`offline` event listeners on window
- On reconnect: automatically calls `attemptSync()`
- Returns cleanup function (removes listeners + cancels pending retry)
