# Architecture

## Monorepo Structure

```
do-epub-studio/
├── apps/
│   ├── web/          # React SPA (Vite, Tailwind CSS, PWA)
│   ├── worker/       # Cloudflare Workers API (Turso/libSQL)
│   └── tests/        # E2E test suite (Playwright)
├── packages/
│   ├── reader-core/  # EPUB rendering engine (adapter over @intity/epub-js)
│   ├── shared/       # DTOs, schemas (Zod), errors, telemetry
│   ├── schema/       # Turso DB schema + migrations
│   ├── testkit/      # Test data builders + fixtures
│   └── ui/           # Shared React components + design system
└── docs/
```

## Data Flow

```
Browser (apps/web)
  │  POST /api/access/request (email + book code)
  │  ← session token (Bearer)
  │
  │  API call with Authorization: Bearer <token>
  │  POST /api/books/{id}/file-url
  │  ← signed R2 URL (1-hour TTL)
  │
  │  EPUB fetch via signed URL → iframe sandbox rendering
  │  Progress/highlights/comments: PUT/POST with mutationId
  ▼
Cloudflare Worker (apps/worker)
  │
  ├─ requireAuth() middleware (apps/worker/src/auth/middleware.ts)
  │   • Parses Bearer token from Authorization header
  │   • SHA-256 hash → lookup in reader_sessions table
  │   • Validates expiry + revoked_at
  │   • Cross-references book_access_grants for capabilities
  │
  ├─ Route handlers (apps/worker/src/routes/)
  │   • books, progress, bookmarks, highlights, comments
  │   • admin CRUD, audit logs
  │
  ├─ libSQL/Turso DB (apps/worker/src/db/)
  │   • reader_sessions, book_access_grants, books
  │   • reader_progress, bookmarks, highlights, comments
  │   • audit_logs
  │
  └─ R2 storage (signed URL generation)
```

## Auth Flow

1. Reader submits email + book code via `/api/access/request`
2. Worker validates code, looks up or creates `book_access_grants` row
3. Creates session in `reader_sessions` → returns hex token (32 bytes)
4. All subsequent requests include `Authorization: Bearer <token>`
5. `requireAuth` middleware validates on every request; 401 triggers client logout
6. Sessions expire after 7 days; grants can be revoked (sets `revoked_at`)

## Key Technologies

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 19 + Zustand 5 (state) |
| Build tool | Vite 8 |
| Styling | Tailwind CSS 4.3 |
| API runtime | Cloudflare Workers (Wrangler 4) |
| Database | Turso/libSQL (embedded replicas) |
| EPUB rendering | @intity/epub-js (adapted via reader-core) |
| Schema validation | Zod 4 |
| Unit testing | Vitest 4.1 + @vitest/coverage-v8 |
| E2E testing | Playwright 1.60 |
| i18n | Custom hook-based (apps/web/src/hooks/useTranslation) |
| PWAs | vite-plugin-pwa + Workbox |

## Adapter Pattern (reader-core)

`packages/reader-core/src/epub-loader.ts` wraps `@intity/epub-js` behind an `EpubLoader` interface:

```typescript
interface EpubLoader {
  load(url: string): Promise<void>;
  createRendition(container: HTMLElement): EpubRenditionHandle;
  destroy(): void;
  getMetadata(): BookMetadata;
  getToc(): TocItem[];
  getSpineItems(): SpineItem[];
  getProgress(): ProgressPosition | null;
  setProgress(cfi: string): Promise<void>;
}
```

The adapter normalizes epub-js API, provides typed return values, and bridges event systems (`relocated`, `displayed`, `attached`, `started`). This isolates the app from upstream epub-js breaking changes and enables testability via mock EpubLoader implementations.

## Rendering Architecture

```
ReaderPage (apps/web/src/features/reader/ReaderPage.tsx)
  │
  ├─ useEffect: fetch signed URL → setEpubUrl
  ├─ useEffect: initEpub → ePub(url) → book.renderTo(div, {sandbox})
  │   • Renders EPUB content inside an iframe with sandbox="allow-same-origin"
  │   • Applies theme/font via rendition.themes.registerRules()
  │   • Tracks relocated events → save progress (online + offline queue)
  │
  └─ Offline: saveProgress + queueSync → IndexedDB + Service Worker
```

---

## Product Definition

`d.o.EPUB Studio` is a web-based EPUB reading and editorial workspace for
self-publishing, controlled distribution, and annotated review.

Capabilities: EPUB reading, gated access by email, optional password protection,
public or private distribution, offline reading as a PWA, bookmarks and highlights,
editorial comments and threaded discussion, audit logging and permission management.

**Primary use cases:**
- Author shares a manuscript EPUB with selected readers
- Editor reviews EPUB with comments and discussion
- Proofreaders access a protected draft
- Selected readers get read-only access
- Public sample books are exposed without grant approval
- Readers continue offline and sync later

---

## Storage Model

| Store | What lives there |
|---|---|
| Cloudflare R2 | EPUB file bytes, covers, derived file assets |
| Turso/libSQL | users, book metadata, grants, sessions, progress, bookmarks, highlights, comments, audit logs |
| IndexedDB + Cache Storage | offline reading state, sync queue, reader preferences |

Do not treat Turso as the primary EPUB file store; do not use R2 as the
application's authorisation system. All file access goes through the Worker gate
with short-lived signed URLs.

---

## Permission and Access Model

**Global roles:** `admin`, `editor`, `reader`

**Book access modes:** `private`, `password_protected`, `reader_only`,
`editorial_review`, `public`

**Capabilities:** `can_read`, `can_comment`, `can_highlight`,
`can_download_offline`, `can_export_notes`, `can_manage_access`

| Mode | Read | Comment | Offline | Password | Public |
|---|---|---|---|---|---|
| private | yes | optional | optional | optional | no |
| password_protected | yes | optional | optional | yes | no |
| reader_only | yes | no | optional | optional | no |
| editorial_review | yes | yes | yes/no | optional | no |
| public | yes | optional | optional | no | yes |

Private and restricted books must be gated by application-level access rules
and short-lived signed URLs — not R2 visibility alone.

---

## Package Boundaries

| Package | Contents |
|---|---|
| `packages/schema` | SQL migrations, DB-adjacent types, schema constants |
| `packages/shared` | shared DTOs, validation helpers, enums, error classes |
| `packages/reader-core` | EPUB abstractions, locator mapping, selection anchors, preference logic |
| `packages/ui` | reusable UI components, layout primitives, forms, modals, panels |
| `apps/web` | routes, reader UI, admin UI, local persistence, sync orchestration |
| `apps/worker` | API routes, session/auth logic, Turso access, R2 signing, audit logging |

---

## Core Database Schema

<details>
<summary>Table definitions (click to expand)</summary>

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    global_role TEXT NOT NULL DEFAULT 'reader',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE books (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    author_name TEXT,
    description TEXT,
    language TEXT,
    visibility TEXT NOT NULL DEFAULT 'private',
    cover_image_url TEXT,
    published_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT
);

CREATE TABLE book_files (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    storage_provider TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    sha256 TEXT,
    epub_version TEXT,
    manifest_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE book_access_grants (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT,
    mode TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 1,
    comments_allowed INTEGER NOT NULL DEFAULT 0,
    offline_allowed INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    invited_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (invited_by_user_id) REFERENCES users(id)
);

CREATE TABLE reader_sessions (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    email TEXT NOT NULL,
    session_token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE reading_progress (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    locator_json TEXT NOT NULL,
    progress_percent REAL,
    updated_at TEXT NOT NULL,
    UNIQUE(book_id, user_email)
);

CREATE TABLE bookmarks (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    locator_json TEXT NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE highlights (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    chapter_ref TEXT,
    cfi_range TEXT,
    selected_text TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    chapter_ref TEXT,
    cfi_range TEXT,
    selected_text TEXT,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    visibility TEXT NOT NULL DEFAULT 'shared',
    parent_comment_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id)
);

CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    actor_email TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload_json TEXT,
    created_at TEXT NOT NULL
);
```

</details>

**Locator strategy:** For annotations and progress, prefer EPUB CFI + selected
text excerpt + chapter reference. Do not rely only on raw DOM offsets.

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| EPUB anchor drift | CFI + selected text + chapter reference fallback (ADR-006) |
| Offline conflict drift | Entity-specific merge rules; append-only comments; idempotent sync mutations |
| Grant leakage | Generic auth errors; short-lived sessions; short-lived signed URLs; audit logs |
| Overcomplicated auth too early | Start with email + optional password; avoid full account system in MVP |
| Public/private storage mistakes | All file access through Worker gate; never expose raw storage paths |
