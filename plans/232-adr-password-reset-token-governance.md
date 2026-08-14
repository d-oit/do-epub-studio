# ADR-232: Password Reset Token Governance

**Date:** 2026-08-13
**Status:** Accepted
**Deciders:** Project maintainer, security reviewer, product owner
**Related:** GOAP-230, ADR-004, ADR-080, ADR-092, ADR-200, ADR-231, ADR-234

## Context

Reader recovery and admin recovery currently use stateless JWT links signed with
`INVITE_TOKEN_SECRET`. The links expire, use purpose checks, and avoid account
enumeration on request. However, they issue sessions rather than resetting
passwords, and there is no persistent single-use token record.

One concrete contract mismatch also exists:

- `apps/web/src/features/admin/AdminRecoverPage.tsx` posts `{ token,
  newPassword }` and expects `{ sessionToken, email }`.
- `apps/worker/src/routes/admin/auth.ts` validates `RecoveryVerifySchema`,
  which accepts only `{ token }`, and returns `{ token, user }`.

## Decision

Replace recovery-session issuance with a reset-token flow for account
passwords, while preserving reader magic-link access only where a book grant is
intentionally passwordless.

Implementation must add:

1. A `password_reset_tokens` table with `id`, `user_id`, `token_hash`,
   `purpose`, `expires_at`, `used_at`, `attempt_count`, `created_at`,
   `requested_ip_hash`, and `request_trace_id`.
2. CSPRNG reset tokens of at least 32 bytes, displayed only once in the email
   link and stored only as a SHA-256 or HMAC-SHA-256 hash.
3. Single-use verification that marks the token used in the same operation that
   changes the password.
4. Short expiry, recommended 15 minutes for admin accounts and 30 minutes for
   reader accounts.
5. Per-account, per-IP, and per-token attempt limits.
6. Uniform response body and timing for existing and non-existing accounts.
7. Password reset pages that require new password plus confirmation and do not
   automatically log the user in after reset.
8. Session revocation after successful reset: all sessions for the account, or
   all except the explicitly reauthenticated current session when applicable.
9. Audit events for reset requested, reset completed, reset denied, reset token
   replay, and reset token expired.

## Reader Grant Recovery

Reader book recovery must be split into two explicit flows:

- **Magic link access** for grants with no password requirement. This may issue
  a reader session, but must use a persisted single-use magic-link token table
  or the same reset-token table with a distinct purpose.
- **Password reset** for account or grant credentials. This updates the stored
  Argon2id password hash and requires normal login after success.

## Admin Recovery Contract

The current admin recovery contract must be fixed in the first implementation
slice:

- Schema accepts `token`, `newPassword`, and `newPasswordConfirm`.
- Worker updates the admin password hash only after token verification.
- Worker returns a reset-complete response, not a login response.
- Web redirects to `/admin/login` with a neutral success state.
- Tests assert that old sessions are revoked and that a reused token fails.

## Alternatives Considered

### Keep stateless JWT recovery

Rejected. Signed JWTs can expire and carry a purpose, but they cannot be
server-revoked or marked used without additional state. Password reset links
need replay resistance.

### Auto-login after password reset

Rejected. OWASP recommends returning the user to the normal login flow after
reset to keep session handling simpler and reduce accidental bypasses.

## Consequences

### Positive

- Reset links become revocable, single-use, and auditable.
- Admin recovery UI and worker contract align.
- Password reset no longer bypasses normal authentication.

### Negative

- Requires a schema migration and cleanup job for expired tokens.
- Adds email-template and route-test coverage.

## Acceptance Criteria

- Reused reset token returns a generic invalid-token response and logs replay
  without storing the raw token.
- Expired reset token cannot change a password.
- Password reset invalidates existing reader/admin sessions.
- Recovery request response does not reveal whether the account exists.
- No reset token, password, or reset URL appears in audit logs or telemetry.
