# GOAP-316 — Migrate to OKLCH Color System

Issue: [#316](https://github.com/d-oit/do-epub-studio/issues/316) — CLOSED 2026-05-26 (COMPLETED)
Status: **Implemented on main; verified this sprint.**

## Goal

Convert the theme palette from hex/rgb to OKLCH custom properties (AGENTS.md
Tier 3), with wide-gamut P3 overrides and sRGB fallback.

## ADR

- **Chosen (as implemented)**: OKLCH literals in
  `apps/web/src/styles/globals.css` custom properties — sRGB-safe base values
  on `:root`/`.dark`/`[data-theme="sepia"]`, plus a `@media (color-gamut: p3)`
  override block (globals.css:142-158) with higher-chroma values for
  wide-gamut displays. Tailwind v4 CSS-first config consumes the same custom
  properties (the old `tailwind.config.js` was removed as inert, commit
  `6c38ff51`), so all utility colors resolve through the tokens.
  Zero hex/rgb literals remain in the token file (grepped 2026-08-29).
- **Rejected**: runtime color-mix/`oklch()` computation via a JS color library
  (unnecessary dependency; static literals suffice for a fixed palette).

## Acceptance → Evidence

| Acceptance | Evidence |
|---|---|
| All theme colors use OKLCH | `globals.css` — 0 hex/rgb matches; `design-tokens.test.ts` asserts `oklch(` literals (e.g. `--color-background: oklch(97.6% 0.011 84)`) |
| P3 displays show wider gamut | `globals.css:142-158` `@media (color-gamut: p3)` overrides |
| sRGB fallback works | base `:root` block with sRGB-safe OKLCH values |
| All existing colors have OKLCH equivalents | token test + full-file grep |

## Effort

M (historical; verification only this sprint).
