# ADR-284: Book-scoped invitation and account lifecycle

**Status:** Accepted for GOAP-284 implementation
**Date:** 2026-09-24
**Deciders:** Project maintainer
**Related:** ADR-004, ADR-231, ADR-232, ADR-234, ADR-999, GOAP-284

## Context

The application can create a book grant and issue reader sessions, but it has no
production workflow for provisioning an ordinary creator account. Creator
assignment requires a canonical `users` row, while only the demo seed creates
such rows. Grant creation also requires an operator to communicate a password
out of band.

Email delivery is optional in code: `EMAIL_SEND` uses the configured transport,
and the fallback only logs. The Pages deployment does not expose the Email
Sending binding, so a production deployment must still have a usable delivery
path. A logging fallback must never be presented to an administrator as a
successful send, and invitation tokens must not enter logs or audit payloads.

## Decision

### D1 — Add a book-scoped invitation record

Create a `book_invitations` table with:

- invitation id, book id, normalized email, and role (`reader` or `creator`);
- token hash, issued/accepted/revoked timestamps, and expiry;
- delivery status and delivery-attempt metadata;
- optional linked user and grant ids;
- administrator audit identity and safe delivery status metadata.

Only one active invitation is allowed for a book/email pair. Resend revokes or
supersedes the previous pending token before creating a replacement.

Invitations are an additive control-plane record. Existing grants remain valid
and are not rewritten by the migration.

### D2 — Keep grant authentication; link canonical users additively

Reader login continues to use the existing normalized-email book grant and its
Argon2id password. Invitation acceptance creates or links a canonical `users`
row because creator assignment requires one, but it does not migrate existing
reader sessions, progress, bookmarks, highlights, comments, or offline state.

Acceptance sets the grant password, not a platform-wide account password. An
existing active grant is never silently overwritten; the invitation is refused
and the operator must use an explicit reset path. The user/grant/creator
assignment mutation is transactional; creator assignment is inserted only after
successful token acceptance.

### D3 — Use a single-use fragment token

Tokens are generated with `crypto.getRandomValues`, stored only as SHA-256
hashes, and scoped to one invitation/book/email/role. The raw token is placed in
the URL fragment (`#token=...`) so it is not included in HTTP `Referer` headers
or ordinary request access logs. The acceptance page removes the fragment from
browser history after reading it and submits the token in a POST body.

Verification checks expiry, revocation, purpose, and claim state. Claiming is
atomic and single-use. Acceptance is rate-limited by IP and token identifier. Deployments with the
Durable Object use the existing limiter; Pages deployments use the additive D1
bucket fallback from migration 0018. Invalid states return a generic response
that does not confirm account or book existence.

### D4 — Hybrid delivery is explicit

When `EMAIL_SEND` is configured, the existing transport sends the invitation.
When it is absent, delivery is `manual_copy_required`; the administrator may
copy a one-time link and deliver it through an approved channel. The UI never
shows `sent` for a logged fallback.

The transport logs recipient metadata and subject only. Message bodies, URLs,
and token previews are not logged. Provider errors are represented by a safe
delivery status and never include a raw token.

### D5 — Creator rights require acceptance and current assignment

The invitation role is a request, not a grant. Acceptance creates the reader
grant and, for a creator invitation, the `book_creators` row. Every creator API
continues to enforce current authentication plus the book-scoped assignment.
Revocation removes the assignment and revokes active reader sessions according
to existing grant rules.

### D6 — Audit without secrets

Invitation creation, delivery, resend, acceptance, expiry, replay, and
revocation are audited. Audit payloads contain invitation/book ids, role, and
safe status codes; they never contain raw tokens, passwords, message bodies, or
full invite URLs. The audit entity enum is extended in the same migration so
invitation writes cannot silently fail the CHECK constraint.

## Alternatives rejected

### Reuse the reader recovery token table without a book/role binding

Rejected. Recovery tokens are account-oriented and have a different purpose;
using them for administrative role assignment would blur token semantics and
make cross-book authorization harder to audit.

### Auto-create an active creator account during grant creation

Rejected. It would silently grant elevated review capability and make an email
address enough to obtain creator access.

### Require email delivery in production

Rejected as the only path. The Pages deployment cannot guarantee the binding,
and an operator must have a controlled manual delivery fallback.

### Migrate all reader authentication to canonical users now

Rejected for this slice. The existing grant/session model is live-tested and
widely used; a broad migration increases regression risk without being required
for invitation onboarding.

### Put the raw token in a query string

Rejected. Query strings are more likely to enter proxy/access logs, analytics,
browser history exports, and referrer chains. The fragment keeps the token out
of the request URL.

## Consequences

### Positive

- A fresh deployment can onboard real readers and creators through the app.
- Creator assignment is explicit, scoped, auditable, and replay-resistant.
- Existing readers and grants remain compatible.
- Operators can onboard when the Pages email binding is unavailable.
- Delivery status is truthful and observable without exposing secrets.

### Negative

- The database and Worker gain an invitation lifecycle and additional audit
  surface.
- Administrators must manage pending invitations and may need a manual delivery
  step in Pages deployments.
- Canonical user identity and grant identity remain temporarily related rather
  than fully unified; a later migration can converge them.

### Security invariants

- Argon2id is the only password hashing algorithm.
- Raw invitation tokens never appear in logs, audit records, telemetry, error
  bodies, or client storage other than the short-lived acceptance flow.
- Every acceptance and creator operation is server-authorized and book-scoped.
- Grant changes and invitation revocation revoke active reader sessions.
- Trace IDs are emitted for every request and delivery attempt.

## Verification

The implementation must prove:

1. Reader and creator invitations work on a fresh non-demo database.
2. Email and manual-copy delivery states are distinct.
3. Expired, revoked, replayed, and cross-book tokens fail closed.
4. Creator access begins only after acceptance.
5. Existing grant login and offline reader state continue to work.
6. No captured log, audit row, or API response contains a raw token.
7. All new UI strings are present in the 13 locale catalogs and the route is
   keyboard accessible.
