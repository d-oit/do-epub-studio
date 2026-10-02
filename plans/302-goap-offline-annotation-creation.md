# GOAP-302: Offline-first ordinary annotation creation (A1)

**Status:** DONE
**Date:** 2026-10-02
**Type:** Corrective implementation slice (authorized from the GOAP-298 audit,
finding A1)
**ADRs referenced:** ADR-005 (offline sync), ADR-006 (annotation model,
multi-signal locators), ADR-214 (audit recommendation governance)
**Source findings:** A1 — "ordinary annotation creation offline-first (product
promise)" in `analysis/comprehensive-gap-audit.md`

## Goal

An authorized reader creates an ordinary highlight and a top-level shared
comment while offline; a reload preserves their chapter/CFI/text anchors;
reconnect creates the server records and settles the pending local state. A
rejected write must stay an intelligible, retained local error — never a
claimed success and never silent data loss.

## Changes

### Server identity and authorization

- `packages/schema/src/schemas/annotation.ts`: optional `mutationId` (UUID) on
  `HighlightCreateSchema` and `CommentCreateSchema`.
- `packages/schema/migrations/0019-annotation-mutation-ids.sql`: `mutation_id`
  columns plus partial unique indexes on `highlights` and `comments`.
- `apps/worker/src/routes/reader/highlights.ts` and `routes/comments.ts`:
  `INSERT … ON CONFLICT(mutation_id) WHERE mutation_id IS NOT NULL DO NOTHING
RETURNING *`; a replay returns the stored row (no second audit or
  notification) only after the stored row's `book_id`/owner match, otherwise
  `403`. Responses never expose `mutation_id` or `user_email`.

### Durable local creation

- `apps/web/src/lib/offline/annotation-mutations.ts` (new): `saveAnnotation`,
  `getAnnotations`, `getUnsyncedAnnotations` moved out of `db.ts`, plus
  `persistAnnotationCreation`, `settleAnnotationCreation`, `failAnnotationCreation`
  and `subscribeAnnotationChanges`. Persist encrypts the annotation and its
  queue item **before** one readwrite transaction over `annotations` +
  `syncQueue`; settle replaces the local id with the server id and removes the
  queue item in one transaction; fail keeps the encrypted record with
  `syncError` and drops the queue item. Each helper requires a non-empty session
  token matching current auth before encryption and again before the
  transaction.
- `apps/web/src/lib/offline/sync.ts` / `sync-item.ts` / `annotation-sync.ts`:
  annotation creates replay through the typed API with the original
  `mutationId`; settlement is authenticated (session + book captured before the
  queue snapshot is read, re-checked before every dispatch and before
  settlement) and never deletes a queue item before the accepted local state is
  durable. Authoritative 400/403/409/413/422 → `annotation_blocked` → durable
  failed local record; 401 keeps the logout path; transient errors keep the
  existing retry/backoff, and exhaustion fails the record instead of dropping
  it.
- `apps/web/src/lib/api/core.ts`: the 401 handler now compares the rejected
  request's bearer token with the current store token, so an in-flight replay
  from a previous session cannot sign out the newer one.

### Reader surface

- `stores/reader.ts` + `mapOfflineAnnotation.ts`: `syncState: 'pending' |
'failed'` and `syncError` on highlights/comments; masked display name and
  stored `updatedAt` restored.
- `useReaderDataLoader`: local annotations are read whenever a session/book
  exists (not only after a server failure), merged with server collections by
  id, with a generation counter so a stale load cannot overwrite newer settled
  state; 401/403 never fall back to cached annotations.
- `CommentItem` / `HighlightItem`: localized pending/failed state with
  `role='status'` / `role='alert'`, and server mutation actions disabled while
  a record is pending or failed. `CommentInput`/`CommentInputModal` await
  submission, keep the text on rejection, and surface the error; `ReaderPage`
  clears the selection only on success and shows highlight failures inline.

## Evidence

- `apps/worker/src/__tests__/annotations-idempotency.integration.test.ts`
  (real `node:sqlite` + all numbered migrations, real routers): first create
  `201`, repeat and concurrent same-key `201→200` with identical id, no second
  row and no second audit/notification; cross-owner and cross-book key reuse
  `403`; capability loss on replay `403`; omitted `mutationId` creates
  independent rows; invalid UUID `400`.
- `apps/web/src/__tests__/reader-annotations.offline.test.tsx` (real
  IndexedDB/encryption/API client, fetch mocked at the boundary): offline
  creation of both entity types, encrypted-at-rest assertions, transaction
  abort leaves nothing, network-`TypeError` queues exactly one durable mutation,
  401/403/400/AbortError reject without queueing, reconnect settles to the
  canonical server ids, a failed local completion retries the same mutation and
  produces no duplicate, and a replay `403` yields a durable failed record with
  no queue item.
- `apps/web/src/lib/offline/sync.test.ts`: deferred-snapshot and stale-401
  regressions (session switch mid-drain dispatches nothing and keeps the
  foreign queue item; a stale-token 401 leaves the new session authenticated).
- Full gates on 2026-10-02: web 144 files / 1442 tests, worker 70 / 534, schema
  16 / 199, `pnpm turbo run typecheck --force` 7/7, `pnpm lint` clean.
- `PLAYWRIGHT_MODE=preview pnpm test:e2e apps/tests/offline-annotations.spec.ts
--project=pwa-chromium` — 1 passed: offline create through the real toolbar
  and comment modal, encrypted local records verified in raw IndexedDB, offline
  reload, passage navigation, reconnect settlement, and the rejected-comment
  path. Local browser proof against a controlled API, not deployed acceptance.
- `docs/offline.md` documents the store shape, the create/replay protocol and
  the failed-record semantics.

## Non-goals

Offline reply/edit/delete and bookmark changes remain network-only; private
editorial feedback is a separate delivered feature. No retry/discard UI is
introduced for failed creates — they are retained, readable and visibly failed.
