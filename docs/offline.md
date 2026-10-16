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

#### Reading-position restore ordering (GOAP-1007)

`reader.progress_loaded` marks the end of the initial progress load — the
server read, or the `progress` store read when that request fails. Until it
settles the reader is showing the book's programmatic first position, and the
app writes **nothing** back for it:

- `useEpubProgress` ignores relocation events while `progressRestored` is
  false (`useReaderDataLoader` flips the flag when the load settles), so the
  first display cannot overwrite the stored entry with the book's start —
  without this, an offline reload read back 0 % from the entry the reload
  itself had just clobbered.
- The navigation display effect ignores store updates whose CFI the rendition
  reported through its own `relocated` event; the rendition is already there,
  and re-displaying it lands asynchronously and reverts page turns made in the
  meantime.

Regression cover: `apps/tests/reader-progress.spec.ts` (offline fallback keeps
the stored percentage) and `apps/tests/reader-migration-smoke.spec.ts`
(chapter navigation).

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

1. Queue entries are ordered by `createdAt`; progress entries are additionally
   topologically ordered by `dependsOnMutationId` so an offline chain is applied
   in the order the reader made the edits.
2. Requests carry the queued mutation ID. Progress PUTs also carry
   `baseRevision`; chained offline writes carry the predecessor's mutation ID.
3. Server idempotency is resource-scoped: duplicate highlight/comment creates
   return the existing row, bookmark creates use their mutation ID, and progress
   mutations are recorded by `(book_id, user_email, mutation_id)` with the exact
   applied revision. A delayed progress retry therefore replays its original
   result without replacing newer progress.
4. On success: remove from `syncQueue`, mark the local entry as `synced: true`,
   and save the acknowledged progress revision.
5. Permanent item-level 4xx failures remain in the queue as failed entries and
   do not block later entries. A 401 pauses the drain and keeps queued work for
   reauthentication; 429, 5xx, and network failures use bounded retries.

### Retry Logic

```typescript
BASE_DELAY_MS = 1000;
MAX_DELAY_MS = 30000;
MAX_RETRY_ATTEMPTS = 5;
// Retry delays: 2s, 4s, 8s, 16s, each with ±25% jitter and a 30s cap.
```

### Conflict Resolution

Conflicts are categorised by `ConflictType` (`progress_update`, `annotation_edit`,
`bookmark_change`, `comment_update`) and stored in both the in-memory
`pendingConflicts` map and the durable `conflicts` IndexedDB store.

| Entity     | Strategy                 | Notes                                                                                                                            |
| ---------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Progress   | Server revision + manual | Compare-and-swap rejects stale writes with HTTP 409. The client durably saves both versions for an explicit local/remote choice. |
| Bookmarks  | Timestamp helper         | Generic `resolveWithLWW` selects the later timestamp.                                                                            |
| Highlights | Timestamp helper         | Generic `resolveWithLWW` selects the later timestamp.                                                                            |
| Comments   | Timestamp helper         | Equal timestamps require manual review; otherwise the later timestamp wins.                                                      |

Progress writes use `baseRevision`; queued writes created offline also include
`dependsOnMutationId`. The Worker accepts a dependency only when it is the
latest server mutation, and returns the exact stored result for duplicate
mutation IDs. A stale edit returns `409 PROGRESS_CONFLICT`; the client fetches
the current revision and records both the local and remote positions without
timestamp-based selection. If durable conflict storage fails, the local queue
entry is retained as a failed item for export or retry.

### Permission Revocation Detection

- `syncItem()` treats 401 as `session_expired` and 403 (or a `revoked` error
  message) as `permission_revoked`.
- Both clear cached permissions. A 401 pauses the drain and keeps queued work
  for reauthentication; a 403 item remains queued as a terminal failure, and
  later items continue.
- `onPermissionRevoked` is called for permission-level revocation so the UI can
  show the access change.

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
2. Processes entries in creation order, respecting progress mutation dependencies.
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
