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

## Phase 3 – Offline & Sync

- Service worker caching policy (app shell, assets, EPUB, covers).
- IndexedDB schema for progress/annotations/queue.
- Permission cache TTL + zombie detection.

## Phase 4 – Editorial Toolkit

- Highlights + comments UI.
- Comment threads/resolution + audit.
- Re-anchoring heuristics per ADR-006.

## Phase 5 – Admin Console

- Book catalog + upload flow.
- Grant editor w/ capability toggles + expiry.
- Audit log UI + export.

## Phase 6 – Hardening & Release

- Accessibility + localization QA (en/de/fr parity).
- Performance + security audits.
- Regression suites (Vitest/Playwright) expanded.
- Release automation + documentation polish.

## Tracking Rules

- Update this file at the end of each phase with actual outcomes + links to PRs.
- Link back to GOAP roadmap (`plans/001-goap-roadmap.md`).
- Include traceability to TRIZ contradictions when defining new workstreams.
