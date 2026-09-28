# GOAP-284 Phase 5 — end-to-end verification

**Status: PARTIAL — 13/14 legs verified, 1 blocked by design. Phase 5 is NOT complete.**

Run 2026-09-28 against the real local stack (`wrangler dev` on
:8787 with D1/KV/R2 bound, Vite on :5173), driving the deployed HTTP
surface rather than mocks.

## Verified (13 assertions, 0 failures)

| #   | Leg                                    | Evidence                                                                             |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Admin authenticates                    | `POST /api/admin/login` → session token                                              |
| 2   | Invitation create is step-up gated     | un-elevated session → **428 STEP_UP_REQUIRED**                                       |
| 3   | Step-up elevation                      | correct password elevates; wrong password → **401**, no elevation                    |
| 4   | Invitation created for a fresh address | `POST /api/admin/books/:id/invitations` → id + `status: pending`                     |
| 5   | **Raw token never on the wire**        | no `rawToken`/`token` field in the response; `copyUrl: null`; `deliveryStatus: sent` |
| 6   | A bogus accept token is refused        | `POST /api/access/accept-invite` → **400**                                           |
| 7   | List + revoke                          | invitation appears in the admin list; revoke returns `ok: true`                      |
| 8   | Unprivileged admin access refused      | anonymous list → **401**                                                             |
| 9   | Feedback gated without a grant         | anonymous `POST /api/books/:id/feedback` → **401**                                   |

Supporting evidence already in the tree: `invitations.test.ts` and
`invitations-lifecycle.integration.test.ts` — **10/10 pass**, including
the assertions that the stored row never contains the raw token
(`expect(insert?.args).not.toContain(result.rawToken)`).

## Two environment findings

1. **The local D1 database was missing migration `0018-book-invitations`.**
   `POST .../invitations` returned a 500 whose stack was
   `D1_ERROR: no such table: book_invitations`, raised from
   `createBookInvitation`. Fixed with
   `wrangler d1 migrations apply do-epub-studio --local` (14 commands).

   Miniflare loads the schema at boot, so the worker had to be stopped
   before applying and restarted after — the behaviour already recorded in
   `agents-docs/LEARNINGS.md` under "Miniflare's local D1 serves the
   schema it loaded at boot". Worth noting that the symptom presented as
   an opaque `INTERNAL_ERROR`; the `traceId` in the JSON body is what led
   to the real cause in the worker log.

2. `wrangler` is not on the repo-root PATH; it lives at
   `apps/worker/node_modules/.bin/wrangler`. `pnpm --filter … dev`
   resolves it, a bare `wrangler dev` does not.

## The leg that is blocked, and why

**accept → read → feedback → creator review** cannot be driven from an
HTTP client, and that is the intended design rather than a gap to work
around:

- `createBookInvitation()` returns the raw token to its **in-process**
  caller only; the route forwards it to the email transport and nothing else.
- D1 stores `token_hash` (`0018-book-invitations.sql:12`, `UNIQUE`), never the
  token.
- `LoggingEmailTransport` deliberately logs only `{ delivery, subject }` —
  `email-transport.ts:21-31` states bodies carry bearer tokens and are never logged.
- With no transport configured the route returns
  `status: 'manual_copy_required'` **with** `copyUrl`; with `EMAIL_SEND` bound
  (it is, in `wrangler.jsonc:58-62`) it returns `copyUrl: null`.

So the accept URL exists only in a recipient's inbox. Two ways forward, both
requiring a decision rather than more local work:

- **a real inbox** (Mailhog/catch-all, or the Resend/Cloudflare test mode
  against a captured address) so the whole chain runs end to end; or
- **an in-process driver** that calls `createBookInvitation()` directly, as the
  integration test already does, and then drives the remaining HTTP legs with
  that token.

The second is faster and needs no new infrastructure, but it verifies less:
it does not exercise the route that a real operator uses.
