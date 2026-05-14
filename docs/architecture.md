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
