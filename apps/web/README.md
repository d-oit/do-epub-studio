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
- **PWA**: Vite PWA plugin + Workbox (precaching, runtime caching, offline fallback)
- **Testing**: Vitest + React Testing Library + Playwright for e2e
