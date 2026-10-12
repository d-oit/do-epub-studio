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

Database: `do-epub-studio` (version 5)

| Store             | Key Path         | Indexes            | Purpose                                                                                 |
| ----------------- | ---------------- | ------------------ | --------------------------------------------------------------------------------------- |
| `progress`        | `id`             | `bookId`, `synced` | Reading position per book                                                               |
| `annotations`     | `id`             | `bookId`, `synced` | Highlights, comments, bookmarks                                                         |
| `syncQueue`       | `id`             | `createdAt`        | Outbound sync mutation queue                                                            |
| `permissions`     | `bookId`         | —                  | Cached grant info for offline access                                                    |
| `readingInsights` | `[bookId, date]` | `bookId`           | Aggregated reading-insight buckets (active minutes/pages)                               |
| `conflicts`       | `id`             | —                  | Durable pending-conflict records (Plan 228)                                             |
| `feedbackDrafts`  | `id`             | `ownerBook`        | Durable private-feedback drafts (owner-scoped, GOAP-999)                                |
| `bookFiles`       | `bookId`         | —                  | Last resolved signed book-file URL for offline reading (encrypted at rest; A5/GOAP-300) |

Schema defined in `apps/web/src/lib/offline/db.ts`:

```typescript
interface ProgressEntry {
  id: string;
  bookId: string;
  cfi: string;
  percentage: number;
  lastRead: number;
  synced: boolean;
  mutationId: string;
}

interface AnnotationEntry {
  id: string;
  bookId: string;
  type: 'highlight' | 'comment' | 'bookmark';
  cfi: string;
  endCfi?: string;
  text?: string;
  comment?: string;
  color?: string;
  chapter?: string;
  createdAt: number;
  updatedAt?: number;
  displayName?: string;
  synced: boolean;
  mutationId: string;
  syncError?: string;
  status?: 'open' | 'resolved';
  visibility?: 'shared' | 'internal' | 'resolved';
}

interface SyncQueueItem {
  id: string;
  type: 'progress' | 'annotation' | 'reading-insight' | 'feedback';
  payload: unknown;
  mutationId: string;
  createdAt: number;
  attempts: number;
  lastAttempt?: number;
  error?: string;
}

interface PermissionCache {
  bookId: string;
  grantId: string;
  canComment: boolean;
  canDownloadOffline: boolean;
  cachedAt: number;
  expiresAt: number;
}
```

### Offline highlight/comment creation (A1, GOAP-302)

When an ordinary highlight or shared comment is created offline, the reader
encrypts the annotation and its matching `syncQueue` item, then writes both in
one IndexedDB transaction. The queue item has `type: 'annotation'`, an
`action: 'create'` payload, and the same `mutationId` as the local record. Only
`id`, `bookId`, and `synced` stay plaintext in the annotation store; the
locator, selected text, comment body, mutation ID, and sync error remain in
`encryptedPayload`.

On reconnect, the queue replays an authenticated highlight or comment POST with
the original mutation ID. The Worker stores a unique `mutation_id` on each
resource type and returns the existing row for duplicate creates, so a retry
does not create duplicate annotations. Successful replay replaces the local
record with the canonical server record and removes the queue item.

Authoritative create failures (400, 403, 409, 413, or 422) remove the queue
item but retain the encrypted local annotation with `syncError`; the reader
shows the failed state instead of retrying it. Transient failures remain queued
for the retry policy below. An online comment POST rejected with 403 remains in
the composer with its draft text intact.

### Offline reading flow (A5, GOAP-300)

When the reader resolves a book's signed file URL online, the URL is stored in
the encrypted `bookFiles` store. On an offline reload:

1. The `POST /api/books/:id/file-url` call cannot succeed; the reader falls
   back to the cached URL **only when `navigator.onLine` is false** — a failed
   online request still surfaces as an error, so an expired or revoked
   capability is never masked by a stale read.
2. The app shell comes from the Workbox precache.
3. The EPUB bytes come from Cache Storage: `/api/files/*` responses are cached
   by the service worker's `book-content` route in production; the
   `external-assets` route serves any cross-origin book URL it has cached.

## Sync Queue & Protocol

### Mutation Flow

```
Reader mutation
  ├→ progress: saveProgress(...) and queueSync('progress', ...)
  └→ offline highlight/comment create: persistAnnotationCreation(...)
       ├→ encrypt and store annotation + syncQueue item atomically
       └→ attemptSync() when online/reconnected
```

### Sync Protocol

1. Queue is FIFO (sorted by `createdAt`)
2. POST/PUT to the Worker API with the queued mutation ID where supported
3. Annotation creates carry `mutationId` to the Worker; unique partial indexes
   on `highlights.mutation_id` and `comments.mutation_id` make duplicate POSTs
   return the existing annotation. Progress upserts and reading-insight merges
   retain their resource-specific idempotency behavior.
4. On success: remove from syncQueue, mark local entry as `synced: true`
5. On failure: increment `attempts`, schedule retry with exponential backoff

### Retry Logic

```typescript
BASE_DELAY_MS = 1000;
MAX_DELAY_MS = 30000;
MAX_RETRY_ATTEMPTS = 5;
// delay = 2s, 4s, 8s, 16s, 30s (capped)
```

### Conflict Resolution

Conflicts are categorised by `ConflictType` (`progress_update`, `annotation_edit`,
`bookmark_change`, `comment_update`) and detected in `apps/web/src/lib/offline/conflict-resolution.ts`.
Two strategies exist — `last_write_wins` and `manual`.

| Entity     | Strategy        | Notes                                                   |
| ---------- | --------------- | ------------------------------------------------------- |
| Progress   | Last-write-wins | Winner chosen by `lastRead` timestamp; no manual review |
| Bookmarks  | Last-write-wins |                                                         |
| Highlights | Last-write-wins |                                                         |
| Comments   | Conditional     | Manual when timestamps collide or diverge               |

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

| Content                                | Cache Name                 | Strategy                             | TTL       |
| -------------------------------------- | -------------------------- | ------------------------------------ | --------- |
| App shell + assets                     | (precache)                 | `precacheAndRoute` (Workbox)         | Permanent |
| Google Fonts stylesheets               | `google-fonts-stylesheets` | CacheFirst                           | 1 year    |
| Google Fonts webfonts                  | `google-fonts-webfonts`    | CacheFirst                           | 1 year    |
| Images                                 | `images`                   | CacheFirst                           | 30 days   |
| External assets (cross-origin non-API) | external-assets            | StaleWhileRevalidate                 | 7 days    |
| EPUB files (`/api/files/`)             | `book-content`             | StaleWhileRevalidate + RangeRequests | 7 days    |
| API responses (`/api/`)                | `api-responses`            | NetworkFirst                         | 1 hour    |

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
