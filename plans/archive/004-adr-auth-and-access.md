# ADR-004: Auth and Access

**Status:** Accepted
**Date:** 2026-04-07

## Context

We need secure access control that:

- Allows authors to share books with specific readers
- Supports optional password protection
- Works offline with cached permissions
- Prevents unauthorized access to private books

**Contradiction:** Security vs Usability - strong access
control WITHOUT authentication friction.

## Decision

### Access Model

```text
Email + Optional Password → Grant → Session → Signed URL
```

### Grant Types

| Mode                 | Description              | Password | Comments |
| -------------------- | ------------------------ | -------- | -------- |
| `private`            | Admin-approved access    | Optional | Optional |
| `password_protected` | Password-gated           | Required | Optional |
| `reader_only`        | Read-only, no interaction| Optional | No       |
| `editorial_review`   | Full commenting          | Optional | Yes      |
| `public`             | Anyone with link         | No       | Optional |

### Session Tokens

- Short-lived JWT tokens (15 minutes)
- Stored in HTTP-only cookie
- Refresh endpoint for extension
- Revoked on grant revocation

### Signed URLs

- R2 presigned URLs for EPUB access
- TTL: 5-15 minutes
- Include session validation
- Never expose raw R2 paths

### Password Handling

- Argon2id hashing (memory-hard KDF)
- Salt per password, stored in grant
- Minimum 8 characters
- No password hint questions

### Audit Logging

All sensitive actions logged:

- `grant_created`, `grant_revoked`, `grant_updated`
- `access_granted`, `access_denied`
- `session_created`, `session_revoked`

## Consequences

**Positive:**

- Generic error messages prevent enumeration
- Short-lived tokens limit exposure
- Audit trail for compliance
- Optional password adds security layer

**Negative:**

- Session management adds complexity
- Token refresh requires client cooperation

## Security Rules

1. Never reveal if email exists in system
2. Rate limit access attempts (5/minute)
3. Hash passwords with Argon2id
4. Expire sessions after inactivity
5. Revoke all sessions on grant revocation

## References

- TRIZ Analysis: Contradiction #1 - Security vs Usability
- Resolution: Token refresh, Equipotentiality, Anti-Weight
  principles
