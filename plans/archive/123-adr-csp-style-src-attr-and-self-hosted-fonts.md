# ADR-123: CSP `style-src-attr` strategy + self-hosted fonts

## Status

Accepted — 2026-07-09. Implements Plan 122.

## Context

The current Content-Security-Policy on both Cloudflare Pages
(`apps/web/public/_headers`) and the Cloudflare Worker
(`apps/worker/src/lib/security-headers.ts`) permits `style-src 'self' 'unsafe-inline'`,
and the Pages CSP additionally allows the external origins
`https://fonts.googleapis.com` (for the Google Fonts stylesheet) and
`https://fonts.gstatic.com` + `https://api.fontshare.com` (for font
files). This combination is a third-party dependency, a privacy leak
(visitor IP exposed to Google on every page load), and a defense-in-
depth weakness (a permitted inline `<style>` injection gives an
attacker one more lever if XSS lands). It was identified as items
SE2 + SE3 in Plan 116 and carried forward in Plan 121's P3 backlog.

We need to remove both `unsafe-inline` from the legacy `style-src`
and every external font origin while preserving React 19 + Vite +
Tailwind v4 functionality (including React's `style={{ … }}` inline
attributes and the new View Transitions API).

## Decision

Two coordinated changes ship under this ADR:

### 1. CSP: split style sources using CSP Level 3

Pages `_headers` CSP substitutes the legacy directive pair:

- **Remove** `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
- **Add** `style-src 'self'; style-src-attr 'unsafe-inline'`

Worker `security-headers.ts` CSP tightens:

- **Remove** `style-src 'self' 'unsafe-inline'`
- **Add** `style-src 'self'` (no `'unsafe-inline'` any longer; the
  API does not serve styles)

`style-src-attr 'unsafe-inline'` is permitted because:

- React 19 + third-party UI primitives attach inline `style="…"`
  attributes on DOM nodes (19+ sites in the codebase, including the
  `VirtualList`, `ProgressBar`, and reader toolbar components).
- Cloudflare Pages serves `index.html` directly from the static asset
  edge; dynamic nonce injection would require a `Functions` middleware
  or proxying HTML through the Worker, both adding latency.
- Hash strategy (`'sha256-…'`) requires a static set of inline
  blocks; Vite + Tailwind v4 inject styles at build output, producing
  a fragile allow-list.

Inline *elements* (`<style>…</style>`) cannot escalate to script
execution in modern browsers, only visual attacks — the only XSS
lever this residual `style-src-attr` opens is cosmetic, while the
`<style>`-block path that an attacker actually needs is closed.

### 2. Self-host Geist + Instrument Serif

Replace `apps/web/index.html`'s `<link href="https://fonts.googleapis.com/css2?…">`
and the `<preconnect>` lines with a comment. Bind the same families
through the @fontsource packages imported at the top of
`apps/web/src/styles/globals.css`:

```css
@import "@fontsource-variable/geist";
@import "@fontsource/instrument-serif/400.css";
@import "@fontsource/instrument-serif/400-italic.css";
```

Selection rationale:

- Variable Geist is one woff2 (~50 KB) covering the 300..700 weights
  we render, removing the need for five separate font files.
- Instrument Serif is loaded only at weight 400, with both upright
  and italic styles — matching the prior Google Fonts URL exactly.
- 700-italic is omitted (not used) for a ~25 KB saving.
- Both families ship under SIL OFL 1.1.

Vite bundles the imported CSS to a single external stylesheet and
processes the woff2 files through its asset pipeline (content-hashed
URLs, cache-friendly). The CSP `font-src 'self'` is sufficient.

## Consequences

### Positive

- `style-src 'self'` is now structurally resistant to injected
  `<style>` blocks — the dominant style-vector XSS class.
- Removes third-party requests to Google + Fontshare on every page
  load: privacy-positive, latency-positive (no DNS + TCP + TLS to
  a third party), availability-positive (no Google outage blast
  radius).
- Workbox PWA precache now hashes the font files: offline reads
  always find a cached copy after first visit.
- DOMPurify (ADR-006) is unchanged — EPUB content sanitization is
  the primary XSS defense and remains the dominant compensating
  control.

### Negative

- Tailwind v4 bundle increases by ~99 KB (woff2 + CSS). Within the
  1.15 MB reader bundle budget documented in Plan 121.
- First-paint shifts to whichever font arrives first among the
  weight axis; `font-display: swap` (the @fontsource default)
  prevents FOIT.
- Vite dev mode HMR still uses injected `<style>` tags, but the
  Vite dev server does NOT enforce the Pages `_headers` CSP — it
  is local-only and works regardless.

### Migration

This change is deployed as a single feature branch
(`security/csp-style-src-attr-and-self-host-fonts`). It does not
require coordination with other PRs and is fully revertible
(single revert restores the old CSP strings; removing the
`@import` lines from `globals.css` is the only rollback step for
the font path).

## Cross-references

- ADR-035 — original CSP policy adopted
- ADR-006 — EPUB sanitization (DOMPurify) as primary XSS defense
- ADR-092 — token storage + compensating controls
- ADR-063 — semantic design tokens (the typography token contracts
  are unchanged; this ADR only changes how those tokens are loaded)
- Plan 116 items SE2, SE3
- Plan 121 § Remaining P3 Backlog
- Plan 122 — execution GOAP for this ADR
