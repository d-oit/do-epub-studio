# @do-epub-studio/web

React 19 + Vite 8 frontend for EPUB Studio. Serves the admin panel and embedded reader UI as a PWA with offline support via Workbox 7.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Typecheck + production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint on `src/` |
| `pnpm test:unit` | Vitest unit tests |

## Architecture

- **Routing**: React Router v7 with nested layouts
- **State**: Zustand 5 stores (auth, reader, books, sync)
- **Styling**: Tailwind CSS 4 via `@tailwindcss/vite`
- **i18n**: Custom lightweight i18n in `src/i18n/`
- **Reader**: Embedded EPUB rendering via `@intity/epub-js` with `@do-epub-studio/reader-core`
- **PWA**: Vite PWA plugin + Workbox (precaching, runtime caching, offline fallback). See [Service Worker Strategies](#service-worker-strategies) for details.
- **Testing**: Vitest + React Testing Library + Playwright for e2e

## Service Worker Strategies

The PWA implements specific caching strategies per resource type to balance speed, freshness, and security:

- **App Shell**: Precached using `workbox-precaching`. Ensures the core UI is always available offline.
- **Navigations**: `NetworkFirst` strategy. Attempts to fetch fresh HTML but falls back to the precached `index.html` (App Shell) if offline or network fails.
- **Immutable Assets**: `CacheFirst` (30-day expiry). Used for hashed JS/CSS, images, and EPUB files.
- **API Responses**: `NetworkFirst` (1-hour expiry). Prefers fresh data for book lists, progress, and annotations, with offline fallback.
- **Sensitive Routes**: `NetworkOnly`. Routes under `/api/admin/` and `/api/access/` are never cached to ensure security and prevent session leakage.
- **External/Other Assets**: `StaleWhileRevalidate` (7-day expiry). Used for non-critical external resources.
