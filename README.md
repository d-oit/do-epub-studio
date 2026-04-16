# d.o. EPUB Studio

A powerful, open-source tool for creating, editing, and managing EPUB files with ease.

## Description

d.o. EPUB Studio is designed to simplify the process of EPUB creation and editing. Whether you're a publisher, author, or developer, this tool provides a user-friendly interface and robust features to streamline your workflow.

## Topics

- `epub`
- `ebook`
- `publishing`
- `open-source`
- `digital-content`

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

[MIT](LICENCE)

## Recent Updates (March 2026)
- **Quality Gate Hardened:** Switched to process-level isolation for unit tests to resolve React 18 concurrency issues.
- **Global Auth Interceptor:** Implemented automatic logout and session expiry redirection in the core API client.
- **Accessibility Integration:** Automated WCAG 2.1 AA audits integrated into the E2E test suite using Playwright and Axe.
