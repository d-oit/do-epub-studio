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

## Amendment A: Full-page visibility and demo info (2026-08-16)

### Problem

The original implementation added demo buttons, admin link, and help link
inside the login card, but the card grew taller than the viewport on
smaller screens. The `items-center` grid + `min-h-[calc(100dvh-3rem)]`
clipped the bottom content (admin description, help link) so users had to
scroll to discover them. The demo buttons also lacked context — no
indication of which account or book slug the demo uses.

### Decision

1. **Layout:** Change auth screens from vertically centered to
   top-anchored + scrollable. The card starts near the top and the page
   scrolls naturally if content exceeds the viewport — no content is
   clipped or hidden below the fold on any viewport.

2. **Demo info panel:** When demo login is enabled, show a compact info
   panel beneath the demo button revealing the reserved demo email
   (`demo.reader@example.local` / `demo.admin@example.local`) and the
   configured demo book slug. This is NOT a credential disclosure — the
   reserved emails are documented in ADR-233 and the seed script; the
   demo password is never shipped to the browser. The panel explains that
   clicking the button signs in to the demo account without a password.

3. **Admin description inside card:** Move the "Are you an author or
   manager?" text and the admin/reader cross-link inside the card so
   they are always visible alongside the form, not orphaned below the
   card in a grid column.

4. **Help link prominence:** Render the help link inside the card footer
   with slightly larger text and a distinct icon-like prefix so it is
   discoverable without scrolling.

### Amendment B: In-app help page and same-origin help URL (2026-08-16)

The original help contract required an absolute external `VITE_HELP_URL`.
On real deployments nobody configured one, so the help link never rendered.
Research into 2025-2026 login/demo UX (Authgear, SaaSUI, MicroFounder,
Rajiv Pant) confirms: the leading pattern is a password-free, one-click
demo (Parabol/Refiner) with an in-product "what this app does / how to use"
page — credentials are not a login-page mechanism.

Decisions:

1. **New public `/help` route** — a standalone page (no auth required)
   explaining what d.o.EPUB Studio does, the reader vs admin roles, and the
   reserved demo accounts (emails + book slug). No demo password is ever
   rendered; ADR-233/244 still forbid browser-shipped credentials.

2. **Same-origin help URL:** `resolveHelpUrl` now accepts a leading-slash
   path (`VITE_HELP_URL=/help`) as an internal route on any origin —
   localhost, previews, production — instead of requiring an absolute
   external URL that deployments never set.

3. **Demo buttons stay local/E2E only.** The Cloudflare Pages preview build
   bakes `VITE_HELP_URL=/help` so the help link renders, but does NOT bake
   `VITE_DEMO_LOGIN_ENABLED` — demo login is gated for local/E2E per
   ADR-233/244. `.env.local.example` documents `VITE_HELP_URL=/help` and
   `VITE_DEMO_BOOK_SLUG=demo` so local dev shows the full demo experience.
