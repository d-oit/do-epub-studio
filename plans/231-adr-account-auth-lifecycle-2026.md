# ADR-231: Account Auth Lifecycle

**Date:** 2026-08-13
**Status:** Accepted
**Deciders:** Project maintainer, security reviewer, product owner
**Related:** GOAP-230, ADR-004, ADR-080, ADR-092, ADR-106, ADR-200, ADR-232, ADR-234

## Context

The application already has a `users` table and admin password auth, but reader
access is still centered on book grants keyed by email. Reader progress,
comments, bookmarks, highlights, sessions, and grants also store email fields.

This supports invitation-based reading, but it leaves several account lifecycle
gaps:

- Reader accounts cannot own credentials independent of a single book grant.
- There is no first-class account status such as disabled, pending verification,
  compromised, or locked.
- Email verification and password-change flows are not modeled as account
  operations.
- Session revocation is split by reader grant and admin session tables, making
  account-wide revocation harder to reason about.

## Decision

Adopt `users` as the canonical account identity for both reader and admin
accounts while preserving email-based grant compatibility during migration.

Implementation must add:

1. `users` lifecycle fields: `email_verified_at`, `disabled_at`,
   `compromised_at`, `last_login_at`, `last_password_change_at`, and
   `password_version`.
2. Nullable `user_id` columns for reader-owned tables that are currently keyed
   by email, followed by an idempotent backfill from lowercase email.
3. Account endpoints for password set, password change, email verification,
   logout-all-sessions, and account status inspection.
4. Shared password policy schemas that allow long passphrases, block known weak
   values, reject service-name derivatives, and avoid composition rules.
5. Account-wide audit events for `account_created`, `email_verified`,
   `password_changed`, `account_disabled`, `account_reenabled`,
   `sessions_revoked`, and `credential_compromised`.
6. Compatibility reads that accept existing email-keyed rows until the migration
   has completed and been verified.

## Security Requirements

- Passwords remain Argon2id-hashed via the existing Worker password helper or
  its account-service replacement.
- Login and password-change endpoints require TLS, Zod validation, rate limits,
  generic errors, and trace IDs.
- Password changes revoke all sessions for that account unless the endpoint is
  explicitly a step-up reauth flow that rotates the current session.
- No forced periodic password rotation. Password changes are event-driven:
  user request, suspected compromise, admin-initiated reset request, or recovery.
- Admins may initiate reset emails but must not set another user's password.

## Alternatives Considered

### Keep grant-email identity only

Rejected. It keeps the current reader flow simple, but cannot support full
account lifecycle, account-wide session revocation, verified email state, or
future MFA/passkeys without duplicating identity logic across grants.

### Replace all email keys in one migration

Rejected. Reader state is broad and includes offline sync paths. A phased
nullable `user_id` backfill reduces migration risk while maintaining current
grant access.

## Consequences

### Positive

- Reader and admin auth share one account lifecycle model.
- Account-wide security actions become auditable and testable.
- Future MFA, passkeys, device/session inventory, and account settings have a
  stable identity anchor.

### Negative

- Migration touches many tables and tests.
- Backward compatibility logic must exist until email-keyed data is fully
  backfilled.

## Acceptance Criteria

- Existing reader grant login and admin login continue to pass.
- New account password set/change tests cover success, weak password rejection,
  invalid current password, rate limit, audit logging, and session revocation.
- Backfill is idempotent and leaves no orphan `user_id` values.
- Admin audit screens can show account events without exposing password hashes
  or reset-token hashes.
