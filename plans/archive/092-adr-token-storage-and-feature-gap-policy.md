# ADR-092: Token Storage and Feature-Gap Policy

> **Status:** Accepted (2026-06-14, retroactively confirmed)
> **Supersedes:** none
> **Related:** `plans/094-goap-plan-092-execution.md`,
> `plans/093-goap-phase-a-jules-in-book-search.md`,
> `docs/security-posture.md:34-40`
> **Deciders:** maintainers, security reviewer
> **Tags:** security, session, storage

## Context

ADR-004 (`plans/archive/004-adr-auth-and-access.md`) originally
mandated short-lived JWT tokens in HTTP-only cookies. The
implementation diverged: tokens are 256-bit random strings,
7-day sessions, stored in `localStorage` via Zustand `persist`.

The 2026-06 plan-092 PR (#527) explicitly recorded this
divergence as an **adopted** posture in
`docs/security-posture.md:34-40`. The plan-093 and plan-094
follow-on PRs reference an "ADR-092" that did not exist on
disk.

This ADR codifies the policy.

## Decision

### Token storage

1. **Bearer header transport.** The reader web app authenticates
   every request with `Authorization: Bearer <token>`, not with
   cookies. The header is never auto-attached by the browser
   across sites, so classic CSRF does not apply.
2. **`localStorage` persistence.** The session token is
   persisted in `localStorage` via Zustand `persist`, key
   `do-epub-auth`. This is **adopted** with the following
   compensating controls (and **only** these):
   - CSP `script-src 'self'` (no `'unsafe-eval'`, no remote
     scripts).
   - `DOMPurify` sanitization of all EPUB content before
     rendering.
   - `safe-regex` (ADR-034) for every regex applied to
     untrusted input.
   - The session token is never logged, never serialized to
     the audit log, never sent to telemetry.
3. **Compensating-control regression test.** The compensating
   controls are load-bearing. ADR-080 adds a regression test
   that asserts the controls are still healthy.
4. **Migration path.** If a future XSS surface is discovered
   that cannot be mitigated, the migration to HTTP-only cookies
   is the documented escape hatch, with the caveat that it
   forces a `SameSite=None; Secure` + CORS-credentials posture
   across separate web/worker origins.

### Feature-gap policy

5. **Definition.** A "feature gap" is a documented user-facing
   capability that the code does not deliver, where the gap
   cannot be discovered by reading the source alone (e.g.,
   "magic-link recovery is not sent" is a gap; "we don't have
   a search button" is a feature request).
6. **Reporting.** Feature gaps are reported in the next swarm
   analysis (`analysis/SWARM_ANALYSIS.md`) with file:line
   evidence and a suggested fix.
7. **Closing.** Closing a feature gap requires a paired PR
   that (a) implements the fix, (b) adds a regression test
   that fails before the fix, and (c) updates the swarm
   report with a `[Closed YYYY-MM]` marker.
8. **Priority matrix.**
   - **Critical** — confidentiality, integrity, or availability
     breach that an attacker can exploit today.
   - **High** — significant UX or governance gap that affects
     most users.
   - **Medium** — important but limited scope.
   - **Low** — informational or aesthetic.

## Consequences

### Positive

- ADR-092 is now a real file. `llms-full.txt`, plans 093 and
  094 all reference a real document.
- The `localStorage` trade-off has a load-bearing regression
  test (ADR-080).
- The feature-gap policy is now written down, not implicit.

### Negative

- None. This is documentation only.

## Compliance

- AGENTS.md TIER-2 rule 8 — gaps are documented as GOAP plans
  and ADRs.
- ADR-004 — the divergence is recorded and accepted.
