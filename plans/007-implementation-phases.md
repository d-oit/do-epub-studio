# 007 – Implementation Phases

## Phase 0 – Foundation (COMPLETE)

- Repo + pnpm/turbo workspace bootstrapped.
- Skills installed; TRIZ analysis/resolution recorded.
- ADRs 002–006 accepted.

## Phase 1 – Schema + Access Spine (COMPLETE)

**Scope:** finalize migrations, DTOs, access endpoints, audit logging.

| Task                             | Output                                             | Owner Notes           |
| -------------------------------- | -------------------------------------------------- | --------------------- | ------------------------------------- | ---------------- |
| `packages/schema` migration pass | `0001-initial-schema.sql` mirrored to Turso        | Align with ADR-003    |
| DTOs + validation                | `packages/shared` exports for grants/sessions      | Reuse in worker + web |
| Access APIs                      | `/api/access/request                               | refresh               | logout` hardened with logging + trace | enforce Argon2id |
| Signed URLs                      | `storage/signed-url.ts` w/ TTL + checksum          | Adds trace logs       |
| Audit trail                      | `apps/worker/src/audit` invoked on grants/sessions | include traceId       |

**Exit criteria:**

- Reader authenticates via UI + Worker.
- Short-lived session + signed EPUB URL returned.
- Audit log entry stored for grant usage.

## Phase 2 – Reader MVP (COMPLETE)

- EPUB.js integration + TOC.
- Theme/typography controls persisted.
- Progress roundtrip via Worker.

**PR:** #11 - merged to main

## Phase 3 – Offline & Sync (COMPLETE)

- Service worker (src/sw.ts) with injectManifest strategy: cache-first for shell/assets/fonts/images, network-first for API, cache-first for EPUB files.
- IndexedDB schema (lib/offline/db.ts) for progress, annotations, sync queue, permission cache.
- Permission cache TTL (24h) + zombie detection with periodic validation (lib/offline/permissions.ts).
- Sync queue with exponential backoff, max 5 retries, permission revocation detection (lib/offline/sync.ts).
- Reader progress locally first, queued sync on reconnect with online/offline listeners.
- PWA manifest icons generated (192x192, 512x512).
- Comprehensive test coverage: offline-db.test.ts, offline-sync.test.ts, offline-permissions.test.ts.
- Permission revocation callback integration for UI notifications.

**PR:** Ready for review

## Phase 4 – Editorial Toolkit (COMPLETE)

- Highlights + comments UI with threaded replies, resolve/unresolve, edit, delete.
- Visual highlight overlays rendered on EPUB text via `rendition.annotations.highlight()`.
- Visual comment markers (underlines) rendered on EPUB text via `rendition.annotations.add('underline')`.
- Re-anchoring heuristics per ADR-006 wired into annotation render flow.
- Bookmark creation, listing, navigation, and deletion UI.
- CommentInput component wired into annotation flow with auto-focus.
- Export notes as Markdown (highlights + comments).
- Offline sync queue fixed to distinguish highlights vs comments.
- Background sync tag `sync-reader-state` registered on app load.

## Phase 5 – Admin Console (COMPLETE)

- Book catalog + upload flow with presigned R2 upload.
- Grant editor with capability toggles, expiry, create/edit/revoke.
- Audit log UI with filtering (entity type, date range, entity ID) + CSV export.
- Admin login page with role-based route guards (`AdminRoute`).
- Admin navigation bar linking Books, Grants, and Audit Log pages.

## Phase 6 – Hardening & Release

- Accessibility + localization QA (en/de/fr parity).
- Performance + security audits.
- Regression suites (Vitest/Playwright) expanded.
- Release automation + documentation polish.

## Tracking Rules

- Update this file at the end of each phase with actual outcomes + links to PRs.
- Link back to GOAP roadmap (`plans/001-goap-roadmap.md`).
- Include traceability to TRIZ contradictions when defining new workstreams.
