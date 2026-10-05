# GOAP-1001: Reader integration gaps

**Status:** DONE — M1/M2/M3 implemented 2026-10-05 (user-authorized)
**Date:** 2026-10-04
**Type:** Corrective implementation backlog (authorized only by a future
decision; this record specifies contracts)
**Source audit:** `plans/1000-goap-implementation-security-e2e-feature-audit.md`
— GOAP-1000, findings M1–M3
**Governance:** `plans/1000-adr-audit-evidence-and-scope.md` (ADR-1000)
**Related:** GOAP-1003 (`plans/1003-goap-e2e-behavior-proof-gaps.md`) — E4's
bookmark proof is M1's acceptance

## Goal

Record the required future behavior for the three confirmed missing-integration
contracts behind M1–M3, so each can be implemented against a written acceptance
instead of a defect anecdote. Source-confirmed omission is sufficient to publish
these rows; the resulting runtime failure has not been observed.

This is a documentation-only slice. It deliberately does **not** invent
migrations, replacement API signatures or parser choices. The planned product
implementation is a separate authorization.

## M1 — Bookmark creation and deletion do not reach the server

| ID  | Priority and evidence | Source and exact gap                                                                                                                                                                                                                                                                                                 | Required future behavior and acceptance                                                                                                                                                                                                                                                                                                                                    |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | P1, source-only       | `apps/web/src/features/reader/hooks/useBookmarkHandlers.ts:27–90`: online create only changes Zustand; delete only removes from Zustand. `useReaderDataLoader.ts:107–112,159–163,273–277` reloads the server bookmark list. Server POST/DELETE already exist at `apps/worker/src/routes/reader/bookmarks.ts:63–125`. | Bookmark creation and deletion must persist under the current authenticated book owner; reload and annotation-triggered refresh must preserve an acknowledged create and must not resurrect an acknowledged delete. Reuse the existing authenticated API boundary, encrypted annotation storage and replay ownership checks; do not establish a second offline convention. |

Acceptance proof: create a bookmark online → create a highlight → reload →
bookmark survives; delete the bookmark → reload → absent. Offline
create/reload/reconnect must produce exactly one durable bookmark, with a
rejection shown honestly and no successful state after a 403.

Recorded limitation: bookmark replay currently follows the legacy path and lacks
the highlight/comment idempotency contract delivered by GOAP-302. Duplicate
safety must not be advertised until it is proven.

Building blocks: existing authenticated reader API client; existing encrypted
annotation store; existing replay queue and its ownership guard; existing server
POST/DELETE bookmark routes; the reader data loader's bookmark refresh path.

## M2 — Notification affordance is unreachable

| ID  | Priority and evidence | Source and exact gap                                                                                                                                                                                                                                                                                                      | Required future behavior and acceptance                                                                                                                                                                                                                                                            |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2  | P1, source-only       | `features/reader/components/notifications/NotificationBadge.tsx` and `NotificationPanel.tsx` have only test consumers; the scoped grep over `apps/web/src` confirmed this. Worker notification production and comment-reply notification exist (`apps/worker/src/routes/notifications.ts`, `routes/comments.ts:177–181`). | A reachable notification affordance and a mutually exclusive reader panel must reuse these components and the existing notification API. Refresh the unread count after read-one and read-all, and respect the shared API auth-loss/error behavior rather than the panel's raw-request convention. |

Acceptance proof: reader B replies to A's shared comment → A sees an unread
notification → opening the referenced comment marks it read → the count
decreases. The empty state and a failed fetch remain distinguishable states.

Scope boundary: private editorial feedback must not be mixed into shared-comment
notifications.

Building blocks: existing notification API routes and unread-count endpoint;
existing reader toolbar affordance pattern; shared API client's auth-loss
handling.

## M3 — Server full-text search has no index owner

| ID  | Priority and evidence         | Source and exact gap                                                                                                                                                                                                                                                                                 | Required future behavior and acceptance                                                                                                |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| M3  | P2, source-only lifecycle gap | `apps/worker/src/routes/search.ts:45–62,89–103` reads `book_search_index`/`book_content_fts`; the scoped grep finds only reader queries and migration definitions, with no production writer. `plans/archive/206-goap-wave6-dead-code-and-circular-dep-cleanup.md:49` records the indexer's removal. | A usable server FTS surface needs a bounded upload/re-upload indexing owner and a completed-index state before results are advertised. |

Acceptance proof: upload a fixture containing a unique phrase → the index
completes → authenticated search returns that chapter; a replacement upload
removes the old phrase and returns the new one; wrong-book access is refused. An
unindexed book reports itself as unindexed, not as "no matches."

Scope boundary: existing browser-local EPUB search works and is not this gap. Do
not prescribe browser DOM or epub.js parsing inside a Worker — the
execution-runtime parser compatibility has not been established, so no parser
choice is fixed here.

Building blocks: existing upload/file pipeline; existing FTS schema and
`book_search_index` bookkeeping table; existing book-scoped authorization on
search.

## Non-actions

- No migration, route signature or parser is proposed.
- M1 does not adopt a second offline queue or replay convention.
- M2 does not extend notification scope to private editorial feedback.
- No runtime execution, test or browser session backs these rows; they are
  source-confirmed contracts awaiting authorization.

## Implementation 2026-10-05 (user-authorized: "read plans/ and implement all missing tasks")

**Status:** DONE — M1, M2, M3 implemented on the anchors named above.

- **M1.** `apps/web/src/features/reader/hooks/useBookmarkHandlers.ts` now POSTs
  online creates through the authenticated reader API and persists the
  server-acknowledged bookmark locally (`saveAnnotation` with the server id),
  rolls the optimistic entry back on failure, and DELETEs online deletions;
  offline creates keep the existing replay queue. Verified by
  `src/__tests__/reader-hooks.annotation.test.ts` (13 tests) and the
  reload-persistence browser flow in `apps/tests/reader-annotations-and-admin.spec.ts`.
  The legacy-replay idempotency limitation recorded above is unchanged.
- **M2.** `NotificationBadge`/`NotificationPanel` gained live consumers: the
  reader toolbar mounts the badge, `ReaderPage` renders the mutually exclusive
  notifications panel, the panel now uses the shared `apiRequest`
  auth-loss/error boundary, and read-one/read-all dispatch
  `do-epub-notification-change` so the unread count refreshes. Verified by
  `src/__tests__/notification-badge.test.tsx`,
  `notification-panel.test.tsx` and `notifications-auth.integration.test.tsx`.
- **M3.** The indexing owner is the admin upload pipeline:
  `POST /api/admin/books/:id/upload-complete` clears the previous
  `book_content_fts`/`book_search_index` rows and rebuilds them from the
  optional `chapters` payload; `POST /api/admin/books/:id/index` (step-up)
  re-indexes an existing book. `UploadCompleteSchema`/`BookIndexSchema`
  (`packages/schema/src/schemas/queries.ts`) carry the contract. Verified by
  `apps/worker/src/__tests__/routes.search.test.ts` including the unindexed
  (`indexed: false`) and wrong-book-access cases.
