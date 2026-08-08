# Typography Decision

**Date:** 2026-07-09
**Status:** Accepted (Plan 121 U4 / ships via PR #750)
**Authoritative source:** [`DESIGN.md`](../DESIGN.md) § Typography

---

## Context

[`DESIGN.md`](../DESIGN.md) declares the project's editorial direction as
**editorial minimalist** — *“inspired by book design, not SaaS dashboards;
clean typography, generous whitespace; muted palette with intentional color
accents.”* Typography is at the heart of that direction.

Plan 115 surfaced item **U4 (typography decision)** asking whether to
“commit to serif/sans pairing or document Geist as intentional.” Both options
resolve the underlying need: the project must have one committed pairing so
every UI surface is consistent, every locale inherits it, and every design
token has a known name.

PR #747 (2026-07-09) committed `Geist` + `Instrument Serif` to `globals.css`,
and PR #748 self-hosted both via the `@fontsource-variable/geist` +
`@fontsource/instrument-serif` packages. This document formalises the design
intent behind that choice so future contributors do not relitigate it.

## Decision

> **The committed typography pairing is serif display + sans body:
> `Instrument Serif` for headings and editorial accents, `Geist` for body,
> with monospace reserved for code and technical content.**

| Role              | Family           | Token            | Fallback chain                                            | Source                              |
|-------------------|------------------|------------------|-----------------------------------------------------------|--------------------------------------|
| Display / heading | `Instrument Serif`| `--font-display` | `Georgia, 'Times New Roman', serif`                       | `@fontsource/instrument-serif`       |
| Body              | `Geist` (variable)| `--font-sans`    | `Inter, system-ui, -apple-system, sans-serif`             | `@fontsource-variable/geist`         |
| Monospace         | (system mono)    | `--font-mono`    | `ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace` | (no self-host — uses platform mono)  |

## Rationale

- **Editorial feel without inauthenticity.** Instrument Serif gives the
  project a printed-book quality. Readers expect serif display in long-form
  reading interfaces; the fallback to `Georgia` is the same family lineage so
  the experience is stable even before font assets load.
- **Variable weight support.** Geist ships as `@fontsource-variable/geist` so
  weight, italics, optical sizing, and font-feature-settings can be tuned per
  surface; the `Inter → system-ui` fallback covers browsers without the
  variable axis.
- **Self-hosted; no third-party origin.** Post-PR #748, both families are
  served from the project's own origin via `@fontsource/*`. No
  `fonts.googleapis.com` / `fonts.gstatic.com` references remain in the CSP
  `_headers` file, removing a third-party origin from the security boundary
  (ADR-035a + Plan 122 / ADR-123).
- **1.6+ body line-height.** Long-form reading needs breath;
  `--text-base` pairs with `--leading-loose` in `globals.css`.

## Implementation references

| Concern                     | Location                                                                          |
|-----------------------------|-----------------------------------------------------------------------------------|
| Token definitions           | `apps/web/src/styles/globals.css` (`@font-face` blocks + `--font-display`, etc.)  |
| Self-hosted font imports    | `apps/web/src/styles/globals.css` (top-of-file `@import "@fontsource-variable/geist";` + `@import "@fontsource/instrument-serif";`) |
| Tailwind v4 wiring          | `@theme inline { --font-display: var(--font-display); ... }` in `globals.css`     |
| CSP allow-list (post-#748)  | `apps/web/public/_headers` (`font-src 'self'` only)                               |
| Used in                     | AppShell headings, Reader toolbar, Account pages, Auth screen                     |

## Consequences

**Positive**

- Single source of truth for typography — no per-locale or per-feature font
  drift.
- Type tokens are wired through Tailwind v4 `@theme`, so any new surface picks
  the right family by default.
- Self-hosting (PR #748) eliminates a third-party origin from the CSP threat
  model.
- Bundle delta quantified by PR #748 (~99 KB woff2 for both families) sits
  within the LCP perf budget; the project's reader performance budget is
  tracked via the Lighthouse mobile preset.

**Negative**

- Locked-in pairing constrains future redesigns. Mitigation: tokens are the
  only visible API; re-skinning the pairing is a `globals.css` edit (one file,
  reviewable in isolation).

## When to reconsider

- A new product surface (e.g., admin or marketing) needs a different
  character that the current pairing cannot accommodate.
- `Geist` raises a licensing concern in a future jurisdiction. (Today: OFL.)
- Browser auto-loading of variable axes becomes widely incompatible and the
  bundle cost reverts above the perf budget.

## Related

- **Plan 121 (U4)** — Initial P3 entry this doc closes.
- **Plan 122 / ADR-123** — Self-hosting migration that this doc references.
- **ADR-035a (CSP)** — `font-src` allow-list; post-#748 entry is `'self'` only.
- **PR #747** — initial commit of Geist + Instrument Serif.
- **PR #748** — self-host migration via `@fontsource` packages.
- **PR #750** — this document + the Plan 121 row update.
- **Plan 115** — origin plan for U4.
