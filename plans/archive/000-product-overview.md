# 000 – Product Overview

## Identity

- **Product:** do EPUB Studio
- **Repository:** `d-oit/do-epub-studio`
- **What it is:** A web-based EPUB reading + editorial workspace combining gated distribution, offline PWA access, and collaborative commentary.

## Core Capabilities

| Area           | Baseline Capability                                                        |
| -------------- | -------------------------------------------------------------------------- |
| Reading        | EPUB.js-powered reader with typography controls, TOC, search, resume state |
| Editorial      | Highlights, bookmarks, threaded comments, resolution workflow              |
| Access control | Email-based grants, optional per-grant password, capability flags          |
| Distribution   | Private, password-protected, editorial, reader-only, and public book modes |
| Offline        | PWA shell, IndexedDB + Cache Storage, queued sync                          |
| Admin          | Book uploads to R2, grant management, audit log                            |

## Stack Snapshot

| Layer            | Choice                                       | Why                                                   |
| ---------------- | -------------------------------------------- | ----------------------------------------------------- |
| Frontend         | TypeScript + Vite + PWA + Zustand + Tailwind | Fast iteration, offline-first controls                |
| Frontend hosting | Cloudflare Pages                             | Free starter tier, global CDN, direct Worker rewrites |
| Reader engine    | EPUB.js                                      | Browser-native EPUB rendering                         |
| Backend          | Cloudflare Workers                           | Edge auth + signed URLs                               |
| Database         | Turso (libSQL)                               | Global SQLite sync with migrations                    |
| Object storage   | Cloudflare R2                                | Binary EPUB + cover storage                           |
| Tests            | Vitest + Playwright                          | Unit/integration + E2E                                |
| CI/CD            | GitHub Actions + Turbo                       | Cached multi-package pipeline                         |

## Access + Capability Model

- Global roles: `admin`, `editor`, `reader`.
- Grant modes: `private`, `password_protected`, `reader_only`, `editorial_review`, `public`.
- Capabilities per grant: `canRead`, `canComment`, `canHighlight`, `canDownloadOffline`, `canExportNotes`, `canManageAccess`.
- Flow: `email (+password)` → grant validation → short-lived session → signed R2 URL → capability-enforced UI.

## Data Model (Turso)

- `users`, `books`, `book_files`, `book_access_grants`, `reader_sessions`.
- Engagement tables: `reading_progress`, `bookmarks`, `highlights`, `comments`.
- Compliance: `audit_log` for grant/session/comment actions.

## Storage Assignments

- **R2**: EPUB binaries, covers, derived assets. Access exclusively through Worker-generated signed URLs (<15 min TTL).
- **Turso**: Metadata, permissions, annotations, audit, sync cursors.
- **Browser**: IndexedDB for progress/annotations/sync queue, Cache Storage for shell/assets/EPUB resources.

## Primary Flows

1. **Admin upload**: create book → upload to R2 → register metadata → create grants → optional invite.
2. **Reader access**: open invite → authenticate → receive session + capabilities → request signed URL → load EPUB → store progress offline.
3. **Editorial review**: select text → anchor via CFI/text snapshot/chapter → queue comment offline if needed → sync + audit.

## Risk Register

- **Anchor drift**: mitigate via multi-signal locators + re-anchoring heuristics.
- **Offline vs revocation**: TTL permission cache + zombie detection on sync.
- **Large EPUB performance**: streaming load + prefetch manifest.
- **Grant leakage**: generic auth errors, session revocation, signed URL TTL, audit trail.

## References

- `plans/001-goap-roadmap.md`
- `plans/002-adr-monorepo-stack.md`
- `plans/003-adr-storage-model.md`
- `plans/004-adr-auth-and-access.md`
- `plans/005-adr-offline-sync.md`
- `plans/006-adr-annotation-model.md`
- `plans/007-implementation-phases.md`
