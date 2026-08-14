# ADR-234: Session and Admin Auth Hardening

**Date:** 2026-08-13
\*\*Status:\*\* Accepted
**Deciders:** Project maintainer, security reviewer, product owner
**Related:** GOAP-230, ADR-080, ADR-092, ADR-200, ADR-212, ADR-214, ADR-231, ADR-232

## Context

The current security posture deliberately uses bearer tokens in `localStorage`
with compensating controls: strict CSP, EPUB sanitization, server-side
revocation, expiry handling, and login lockout. Admin sessions are separate
bearer tokens with an 8-hour TTL.

This remains workable, but full 2026 account auth should add stronger admin
controls and clearer session lifecycle semantics before expanding account
features.

## Decision

Keep bearer tokens for now, but add account-wide session lifecycle controls,
admin step-up checks, and MFA-ready metadata.

Implementation must add:

1. Session inventory endpoints for current account sessions, with hashed device
   labels and last-used timestamps.
2. Logout-all-sessions for reader and admin accounts.
3. Session rotation after refresh, password change, reset, email change, role
   change, MFA enrollment change, and sensitive admin reauthentication.
4. Admin sensitive-action reauthentication for role changes, grant bulk revoke,
   upload/delete book files, demo seed enablement, and account disable/reenable.
5. MFA-ready schema for admin accounts, preferring WebAuthn/passkeys for future
   phishing-resistant auth and allowing TOTP only as a transitional factor.
6. Recovery codes stored hashed, single-use, and regenerated only after step-up
   auth.
7. Risk-event handling for impossible travel signals if available, repeated
   failed login/reset attempts, token replay, and suspicious device changes.
8. Audit events for session list, revoke current, revoke all, step-up success,
   step-up failure, MFA enroll, MFA remove, and recovery-code regeneration.

## Admin Assurance Levels

| Operation | Required assurance |
| --- | --- |
| Admin read-only pages | Valid admin session. |
| Book/grant mutations | Fresh admin session or recent step-up. |
| Role/account changes | Recent step-up plus MFA when MFA is enrolled. |
| MFA enrollment/removal | Recent step-up and current-password verification. |
| Demo admin enablement | Recent step-up and non-production environment gate. |

## Alternatives Considered

### Move immediately to httpOnly cookie sessions

Deferred. ADR-092 and `docs/security-posture.md` document why bearer tokens are
currently retained. A cookie migration would require a separate CSRF and CORS
ADR because browser auto-attachment changes the threat model.

### Require MFA for every admin request

Rejected. It would add friction without materially improving low-risk admin
reads. Step-up for sensitive actions gives better risk-adjusted coverage.

## Consequences

### Positive

- Admin mutations gain stronger protection without disrupting ordinary reads.
- Account reset and password-change flows have consistent session revocation.
- Future passkey/MFA implementation has a schema and policy target.

### Negative

- Requires new UI states for step-up and session inventory.
- Tests must cover both reader and admin session tables during the migration to
  canonical accounts.

## Acceptance Criteria

- Password reset and password change revoke or rotate all relevant sessions.
- Admin sensitive mutations fail without fresh assurance.
- MFA metadata cannot downgrade an enrolled account without step-up.
- Audit logs contain event names and trace IDs, but no tokens, passwords,
  recovery codes, user agents, or raw IP addresses.

## Closure Record (2026-08-13)

- **Items 1–4** (session inventory, logout-all, rotation, step-up reauth,
  MFA-ready schema) implemented in PR #974.
- **Items 5–6** (WebAuthn passkeys enroll/remove + recovery-code
  generate/regenerate) implemented in the ADR-234 items 5+6 follow-up PR:
  `passkey_credentials` + `webauthn_challenges` tables (migration 0010);
  `auth/mfa.ts` helper layer; `middleware/mfa.ts` `requireMfa`; MFA routes on
  the admin `authRouter`; shared Zod schemas; web `useAdminMfa` hook,
  `MfaSection` in Account Settings, and `isMfaRequired` passkey step-up in
  `step-up.tsx`. Recovery codes are SHA-256 hashed at rest, single-use
  (rewrite-on-match), and displayed once. Enrollment requires recent password
  step-up + current password; removal/regeneration require `mfa` assurance.
  Passkey authentication rotates the bearer token and revokes other sessions.
- **Item 7** (risk-event handling) remains deferred to a follow-up PR. The
  `verifyRecoveryCode` helper is implemented and tested as the hook for the
  deferred risk/factor-recovery work.
