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

Database: `do-epub-studio` (version 3)

| Store | Key Path | Indexes | Purpose |
|-------|----------|---------|---------|
| `progress` | `id` | `bookId`, `synced` | Reading position per book |
| `annotations` | `id` | `bookId`, `synced` | Highlights, comments, bookmarks |
| `syncQueue` | `id` | `createdAt` | Outbound sync mutation queue |
| `permissions` | `bookId` | — | Cached grant info for offline access |
| `readingInsights` | `[bookId, date]` | `bookId` | Aggregated reading-insight buckets (active minutes/pages) |
| `conflicts` | `id` | — | Durable pending-conflict records (Plan 228) |

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
  status?: 'open' | 'resolved';
  visibility?: 'shared' | 'internal' | 'resolved';
}

interface SyncQueueItem {
  id: string; type: 'progress' | 'annotation' | 'reading-insight';
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
2. POST/PUT to Worker API with `mutationId` in body (client-side correlation only)
3. Server idempotency is per-resource, not per-mutationId: progress UPSERTs on
   `(book_id, user_email)` and reading-insight buckets merge with `MAX()`; the
   `mutationId` itself is not read by any worker route
4. On success: remove from syncQueue, mark local entry as `synced: true`
5. On failure: increment `attempts`, schedule retry with exponential backoff

### Retry Logic

```typescript
BASE_DELAY_MS = 1000
MAX_DELAY_MS = 30000
MAX_RETRY_ATTEMPTS = 5
// delay = 2s, 4s, 8s, 16s, 30s (capped)
```

### Conflict Resolution

Conflicts are categorised by `ConflictType` (`progress_update`, `annotation_edit`,
`bookmark_change`, `comment_update`) and detected in `apps/web/src/lib/offline/conflict-resolution.ts`.
Two strategies exist — `last_write_wins` and `manual`.

| Entity | Strategy | Notes |
|--------|----------|-------|
| Progress | Last-write-wins | Winner chosen by `lastRead` timestamp; no manual review |
| Bookmarks | Last-write-wins | |
| Highlights | Last-write-wins | |
| Comments | Conditional | Manual when timestamps collide or diverge |

When local and remote timestamps collide (`localTimestamp === remoteTimestamp`) or
diverge beyond `MANUAL_CONFLICT_THRESHOLD_MS` (5s), `resolveConflict` returns the
`Manual` strategy and records a `ConflictRecord` in both the in-memory
`pendingConflicts` map and the durable `conflicts` IndexedDB store (Plan 228
F2). The sync item is then removed from the queue and the worker responds
`409 conflict_requires_manual_resolution` so it is not retried forever; the UI
surfaces the pending conflict for a manual local/remote (or merged) resolution
via `resolveManualConflict`.

Otherwise conflicts auto-resolve with `resolveWithLWW` (`last_write_wins`),
taking the version with the later timestamp. The earlier claim that comments are
"append-only (no overwrite)" is incorrect — comment edits sync through
`PATCH /api/comments/:id` and follow the same conflict-detection path.

### Permission Revocation Detection

- `syncItem()` returns `permission_revoked` on 401/403 or `revoked` in error message
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
| External assets (cross-origin non-API) | external-assets | StaleWhileRevalidate | 7 days |
| EPUB files (`/api/files/`) | `book-content` | StaleWhileRevalidate + RangeRequests | 7 days |
| API responses (`/api/`) | `api-responses` | NetworkFirst | 1 hour |

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
