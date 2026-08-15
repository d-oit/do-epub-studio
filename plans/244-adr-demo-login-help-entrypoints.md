# ADR-244: Demo Login and Help Entry Points

**Date:** 2026-08-15
**Status:** Accepted
**Deciders:** Project maintainer, security reviewer, product owner
**Related:** GOAP-244, ADR-004, ADR-080, ADR-092, ADR-231, ADR-233, ADR-234

## Context

ADR-233 established safe demo-account seeding through an explicit,
environment-gated script. The codebase now has separate reserved demo reader
and admin accounts, but the login screens do not expose an easy way to use
them. A user must know the reserved identifier, any operator-provided password,
and the reader demo book slug.

The auth screens also do not point users to a help/how-to-use destination.
Existing documentation is primarily for contributors and operators, not for
readers or admins trying the app.

## Decision

Add visible, role-specific demo login entry points and a visible help link to
the authentication screens, with server-side fail-closed controls.

Implementation must provide:

1. Separate reader and admin demo actions on their respective login screens.
2. Separate Worker demo-session endpoints for reader and admin demo login.
3. A Worker-side demo-login gate that refuses production-like environments even
   when the frontend flag is enabled.
4. Verification that demo users are marked `created_by_demo=1` before minting a
   session.
5. Reader demo login scoped to the configured demo book and its live demo grant.
6. Admin demo login denied when the account is disabled, compromised, non-admin,
   or not marked as a demo account.
7. No browser-shipped demo passwords and no tracked plaintext demo credentials.
8. Audit/telemetry events with trace IDs and without tokens, passwords, reset
   links, raw IPs, or credential material.
9. A public, validated help URL contract for both auth screens.

## Configuration Contract

- `DEMO_LOGIN_ENABLED=1` enables Worker demo-session endpoints only after all
  environment and account checks pass.
- `DEMO_BOOK_SLUG` selects the reader demo book; default may match ADR-233's
  seed default.
- `VITE_DEMO_LOGIN_ENABLED=1` controls only frontend visibility.
- `VITE_HELP_URL` provides the help/how-to-use destination and must be validated
  before rendering.

Frontend flags are never authoritative. The Worker gate is the security
boundary.

## Security Requirements

- Demo login must never be implemented by committing demo passwords or placing
  demo passwords in `VITE_*` variables.
- Demo endpoints must return a generic disabled/unauthorized response when the
  environment, account, book, or grant is not eligible.
- Demo admin login must not bypass existing admin route guards, account state
  checks, session TTLs, or step-up requirements.
- Demo reader login must not grant access to uploaded private books other than
  the configured demo book.
- Help links that leave the app must use `rel="noopener noreferrer"`.

## Alternatives Considered

### Pre-fill tracked demo credentials in the login form

Rejected. It makes demo access easy but pushes credential material into browser
code, screenshots, logs, and test fixtures.

### Display only the reserved demo email

Rejected. It avoids password disclosure but still requires manual setup and does
not satisfy the easy-login requirement.

### Use a single generic demo endpoint

Rejected. Reader and admin demo sessions have different response shapes,
permission boundaries, and audit expectations. Separate endpoints are easier to
test and reason about.

### Hardcode a help website URL

Rejected. The repo bans hardcoded environment-specific URLs. A public config
value keeps deployment ownership outside source code.

## Consequences

### Positive

- New users and reviewers can enter reader/admin demo flows without knowing
  setup internals.
- Demo credentials remain server-side and environment-gated.
- Auth screens gain a stable path to end-user help.

### Negative

- Adds another public config contract and tests.
- Adds a small Worker route surface that must be kept fail-closed.
- Requires all locale catalogs to receive new auth-screen copy.

## Acceptance Criteria

- Worker tests cover disabled config, production-like environment, missing demo
  book/grant, disabled admin, and successful local demo session minting.
- Web tests cover both demo buttons and both help links.
- The implementation does not add plaintext demo credentials, real personal
  data, or hardcoded deployment-specific URLs.
- `./scripts/quality_gate.sh` and the Codacy PR check pass before merge.

