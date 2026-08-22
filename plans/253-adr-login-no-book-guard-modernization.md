# ADR-253: Login No-Book-Context Guard & UI Modernization

**Status:** ACCEPTED
**Date:** 2026-08-22
**Related:** ADR-245 (login UX redesign), ADR-249 (password toggle placement), PR #1028, GOAP-248 (audit), GOAP-253

## Context

PR #1028 ships a glass-morphism overhaul of the reader/admin login pages, a
`bookSlug` contract change, and a Cloudflare Pages E2E spec. Review surfaced
four facts:

1. **Dead-end submit state.** Navigating to `/login` without `?book=` renders
   a fully submittable form whose only possible outcome is a server 400
   (`MISSING_BOOK`). The form action always sends `bookSlug` (possibly `''`),
   because access grants are per-book. Demo login is book-independent
   (`/api/demo/reader-login`, no payload) and must stay reachable.
2. **Contract shape after #1028.** `AccessRequestSchema.bookSlug` /
   `RecoveryRequestSchema.bookSlug` became optional-and-empty-tolerant at the
   transport layer while `/api/access/request` and
   `/api/access/recovery-request` enforce presence via a dedicated
   `400 MISSING_BOOK` apiError before rate limiting. Net behavior matches the
   old `min(1)` rejection but with a clearer machine-readable code and no zod
   internals leaking to clients.
3. **Brittle E2E anchors.** The new `cloudflare-login.spec.ts` selects
   structural regions by Tailwind classes (`section.glass-card`,
   `section.hidden.lg\:block`) — styling refactors will silently break tests.
4. **Reference repo unavailable.** `github.com/d-oit/epub-sparkle` does not
   resolve publicly or via authenticated API, and no local copy exists. The
   repo's own 2026 standards (`reader-ui-ux` skill, OKLCH tokens, View
   Transitions with `prevent-flicker`, global `prefers-reduced-motion` block)
   are verified present and serve as the modernization baseline instead.

Additionally, production CSS audit found: the Tailwind v4 lightningcss
pipeline rewrites literal `backdrop-filter` + `-webkit-backdrop-filter`
pairs down to the `-webkit-` form only, leaving Firefox without glass blur
(see GOAP-253 §7 A5).

## Decision

1. **Client-side no-book guard (new work).** On `/login` with an empty
   `bookSlug`, render a localized inline notice above the credentials form and
   disable the submit button. Demo login stays enabled. Recovery mode is
   token-driven and unaffected. The server-side `MISSING_BOOK` guard remains
   as defense-in-depth for direct API clients.
2. **Keep the #1028 two-layer contract.** Transport schema tolerates absent
   `bookSlug`; access/recovery endpoints own the semantic requirement
   (`MISSING_BOOK`). Documented here as intentional; demo endpoints remain
   book-independent. Reverting to `min(1)` was rejected: it reintroduces
   opaque zod error shapes for zero behavioral gain and churns CI-validated,
   Codacy-clean code.
3. **Stable test anchors (hardening).** Add `data-testid` hooks
   (`login-card`, `login-hero`, `login-mobile-info`, `admin-login-card`,
   `admin-login-hero`, `admin-mobile-info`) to the six structural regions and
   migrate the E2E spec off class-name selectors. Role/text queries stay
   preferred where they exist.
4. **Backdrop-filter build contract.** Remove redundant per-element
   `backdrop-blur-lg` utilities (they overrode `.glass-card`'s
   saturate(150%)) and guarantee both property forms ship in production via
   the build-only `restoreStandardBackdropFilter()` Vite plugin, until
   lightningcss corrects its backdrop-filter browser data.
5. **Modernization baseline.** No speculative feature ports from an
   unreachable reference. Verified-in-repo standards (View Transitions,
   reduced-motion, OKLCH semantic tokens, panel mutual exclusivity) are
   asserted, not rebuilt.

## Consequences

- Users landing on book-less links get actionable guidance instead of a
  failed request; `/api/access/*` traffic from the web app becomes
  well-formed by construction.
- E2E suites survive visual restyling; only semantic structure changes break
  them.
- The schema-level leniency is now a documented invariant reviewers can check
  against, closing the "weakened contract" review concern without revert
  churn.
- Glass blur is once again cross-browser in production; a build-output
  assertion point now exists for future Tailwind/lightningcss bumps.

## Compliance

- i18n: new string added to all 14 locale catalogs (CI-enforced parity).
- a11y: notice uses `role="status"` semantics; disabled submit remains
  focus-visible per ui package conventions; no motion changes.
- Security: no auth logic touched; guard is presentation-only.
