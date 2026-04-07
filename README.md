# do EPUB Studio

A web-based EPUB reader and editorial workspace with gated access, offline reading, and collaborative annotations.

## Features

- **EPUB Reader**: Render EPUBs with EPUB.js.
- **Access Control**: Private, password-protected, or public access.
- **Offline Support**: PWA with IndexedDB and service worker for offline reading.
- **Editorial Workspace**: Bookmarks, highlights, and threaded comments.
- **Audit Logging**: Track access, comments, and admin actions.

## Quick Start

See [docs/setup-local.md](docs/setup-local.md) for local development setup.

## Architecture

- **Frontend**: TypeScript + Vite + PWA + Zustand
- **Backend**: Cloudflare Workers
- **Database**: Turso
- **Storage**: Cloudflare R2
- **Testing**: Vitest + Playwright

## License

MIT
