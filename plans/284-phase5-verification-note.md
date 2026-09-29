# GOAP-284 Phase 5 — end-to-end verification

**Status: DONE — 13/13 verified against the live stack on 2026-09-28. One real bug found and fixed.**

## How the accept leg was reached

The accept token is deliberately unreachable from an HTTP client: `createBookInvitation()`
returns it only to its in-process caller, D1 stores `token_hash` (`0018-book-invitations.sql:12`,
`UNIQUE`), and `LoggingEmailTransport` logs only `{ delivery, subject }` because bodies carry
bearer tokens (`email-transport.ts:21-31`).

It does not need an HTTP client either. Per Cloudflare's local-development docs,
`wrangler dev` **simulates** the `send_email` binding and writes each message body to
`/tmp/miniflare-*/email/email-text/<message-id>.txt`. The accept URL is in that body, so the
whole chain runs through the real delivery path — no extra dependency, no in-process shortcut,
and nothing that an operator would not do.

Two details the docs do not state: wrangler 4.135.0 writes to `email/email-text/`, not
`files/email-text/` as the example shows; and the artifact is the **body only** — it carries the
subject text and the accept URL but **not the recipient address**, so the invitation cannot be
located by address. Selection is "newest file", and correctness is proved downstream by the
accept succeeding and the reader's own list containing exactly their item.

## Result: 13/13

| #   | Leg                                    | Evidence                                            |
| --- | -------------------------------------- | --------------------------------------------------- |
| 1   | Step-up elevation                      | correct password elevates; wrong password → **401** |
| 2   | Invitation created for a fresh address | `status: pending`, `deliveryStatus: sent`           |
| 3   | Token never on the wire                | no token field in the response; `copyUrl: null`     |
| 4   | Token recovered from the message body  | 64 chars, read from the simulated inbox             |
| 5   | Invitation accepted                    | **returns a live session**                          |
| 6   | Accepted reader can log in and read    | both paths succeed                                  |
| 7   | Feedback accepted                      | id assigned, state `open`                           |
| 8   | Reader sees only their own item        | exactly 1                                           |
| 9   | Creator surface requires assignment    | **403** for an unassigned reader (COL-01)           |
| 10  | Revocation fails closed                | revoked reader cannot obtain a session              |

An earlier partial run (13 reachable legs, no accept) is superseded by this one.

## The bug this found

`GET /api/books/:id` resolved `:id` (which the route contract accepts as **id OR slug**) _after_
the tenant-isolation guard, but the guard compares its argument against `auth.bookId` — a UUID —
and queries `book_access_grants.book_id` with the raw param. A reader authorised for a book was
therefore refused with `BOOK_SESSION_MISMATCH` when asking for that same book **by slug**.

Proven live before the fix, same session and same book:

```
GET /api/books/68f49b5f-0263-4e99-ad31-dc40265f23cf  -> 200
GET /api/books/demo                                   -> 403 BOOK_SESSION_MISMATCH
```

The sibling route on the same router, `POST /:id/file-url`, already resolves first and carries a
comment saying exactly why — so the guard behaviour was correct and only this route's ordering was
wrong. Fixed by resolving the param before `assertBookAccess`; the route now passes the canonical
UUID, and the id-OR-slug lookup below it is unchanged, so no URL that worked stops working.

Regression test added in `routes.books.test.ts`; it fails when the fix is reverted (verified).

- worker suite: **537/537 pass**
- `routes.books.test.ts`: **7/7 pass**
- `pnpm --filter @do-epub-studio/worker typecheck`: clean

## Environment notes

- The local D1 database was missing `0018-book-invitations`; the route 500'd with an opaque
  `INTERNAL_ERROR` and the real cause (`no such table: book_invitations`) was only in the worker
  log, reachable by grepping the `traceId`. Miniflare holds its boot-time schema, so the worker
  was stopped → migrated → restarted.
- `wrangler` is not on the repo-root PATH; it resolves at `apps/worker/node_modules/.bin/wrangler`.
- `commentsAllowed` defaults to **false** (`invitations.ts:31`, the COL-01 secure default), so the
  invitation must request it or feedback is 403 by design — worth asserting rather than assuming.
- A local Vite on :5173 makes `test:e2e:smoke` fail with "already used"; Playwright starts its own.
