# ADR-200: Login Lockout as Compensating Control for localStorage Token Storage

> **Status:** Accepted (2026-07-30)
> **Supersedes:** none; extends ADR-092
> **Related:** `plans/archive/092-adr-token-storage-and-feature-gap-policy.md`,
> `plans/archive/080-adr-session-storage-compensating-controls.md`,
> `docs/security-posture.md`
> **Deciders:** maintainers, security reviewer
> **Tags:** security, session, storage, rate-limiting

## Context

ADR-092 accepted `localStorage` for session token storage with compensating
controls: strict CSP, DOMPurify sanitization of EPUB content, safe-regex for
untrusted input, and no token logging. ADR-080 added a CI regression test to
keep those controls load-bearing.

Wave 4 (2026-07) introduced a new server-side control: login rate limiting and
account lockout via `RateLimiterDO` (a Cloudflare Durable Object) in
`apps/worker/src/routes/access.ts`. The lockout logic operates as follows:

- Namespace `auth_failures:<email>` counts failed login attempts per email
  address within a sliding 15-minute window.
- After **5 failed attempts** in that window, subsequent login attempts for
  that email return **HTTP 423 Locked** until the window expires.
- Namespace `auth_lockout:<email>` holds the lock entry itself; expiry is
  set to 15 minutes.

This control limits the blast radius of certain attack scenarios that were
previously unmitigated by the ADR-092 controls alone.

## Decision

Accept login lockout as an additional compensating control layered on top of
the existing ADR-092 controls. The control is documented here so auditors and
future contributors know it is intentional and expected.

### How the control narrows the threat surface

| Threat | ADR-092 controls | Wave 4 lockout control |
|---|---|---|
| XSS token exfiltration | CSP blocks inline scripts; DOMPurify strips EPUB XSS vectors | N/A (lockout does not prevent exfiltration) |
| Session brute-force via stolen token | Token is 256-bit random; infeasible to guess | N/A (token itself is not guessed) |
| Credential brute-force after partial pivot | — | **Lockout after 5 attempts / 15 min** blocks enumeration of new sessions |
| Token replay after expiry | 7-day expiry + grant revocation | — |

The lockout does not directly prevent XSS-based token theft (that is the CSP
and sanitizer's job). It narrows the blast radius when an attacker uses a
stolen token as a foothold to enumerate or brute-force other users' credentials
via the login endpoint.

### Durable Object namespaces

- `auth_failures:<email>` — incremented on every failed login; TTL 15 min.
- `auth_lockout:<email>` — set on the 5th failure; TTL 15 min. Presence of
  this key causes the login handler to return 423 without checking the
  password (constant-time fast-fail).

## Consequences

### Positive

- Narrows the brute-force window from unlimited to 5 attempts / 15 minutes.
- Requires no client-side changes; lockout is purely server-side.
- Consistent with AGENTS.md Tier 1 rate-limiting guidance.

### Negative

- A legitimate user who mistyped their password 5 times must wait up to
  15 minutes before retrying, or contact an admin to manually clear the lock.
- An adversary who knows a target email can intentionally trigger lockout to
  deny the legitimate user access (account-lockout DoS). The 15-minute TTL
  limits the persistence of this attack.

### Neutral

- No change to the token storage posture — `localStorage` remains the
  accepted storage location per ADR-092.

## Compliance

- AGENTS.md TIER-2 rule 8 — documented as an ADR.
- ADR-092 — this ADR extends rather than supersedes the localStorage posture.
- ADR-004 — consistent with the auth and access policy; no regression to
  the bearer-header transport model.
