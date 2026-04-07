# d.o. EPUB Studio

A powerful, open-source tool for creating, editing, and managing EPUB files with ease.

## Description
d.o. EPUB Studio is designed to simplify the process of EPUB creation and editing. Whether you're a publisher, author, or developer, this tool provides a user-friendly interface and robust features to streamline your workflow.

## Website
🌐 [Visit our website](https://d-oit.github.io/do-epub-studio/)

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

MIT