# GOAP-253: Execute ADR-253 — Login No-Book Guard, E2E Hardening, Blur Audit

**Status:** COMPLETE — executed on PR #1028 (2026-08-22)
**Date:** 2026-08-22
**Related:** ADR-253, PR #1028, ADR-245, GOAP-248

## 1. Goal

Implement the ADR-253 decisions on branch `feat/login-visual-overhaul` (PR
#1028) so the PR can merge with review findings addressed: no-dead-end login
UX, stable E2E anchors, and a verified single source of truth for the glass
blur.

## 2. State Analysis

- PR #1028 CI: all green (CI matrix, Lighthouse, bundle budget, Chromatic,
  CodeQL, Codacy 0 issues). Merge state CLEAN, 0 unresolved threads.
- `apps/web/src/features/auth/LoginPage.tsx`: form action posts
  `{email, password, bookSlug}`; `bookSlug = searchParams.get('book') || ''`.
  `LoginCardHeader` already renders the book chip conditionally.
- `apps/web/src/features/auth/LoginForm.tsx`: `SubmitButton` wraps
  `useFormStatus`; no disabled/notice pathway exists.
- `apps/web/src/styles/globals.css`: `.glass-card` = blur(16px) saturate(150%)
  in `@layer components`; global `prefers-reduced-motion` block present.
- i18n catalogs: `apps/web/src/i18n/{en,de,fr}.ts`, no no-book key exists.
- E2E spec `apps/tests/cloudflare-login.spec.ts` selects
  `section.glass-card` / `section.hidden.lg\\:block` / `div.glass-card.lg\\:hidden`.

## 3. Actions

| # | Action | Files | Gate |
|---|--------|-------|------|
| A1 | Add no-book notice + disabled submit on `/login` when `bookSlug === ''` (demo login untouched; recovery untouched) | `LoginForm.tsx`, `LoginPage.tsx` | Unit tests green |
| A2 | Localize notice + aria label (en/de/fr) | `i18n/en.ts`, `i18n/de.ts`, `i18n/fr.ts` | i18n parity test |
| A3 | `data-testid` anchors on 6 structural regions | `LoginPage.tsx`, `LoginHero.tsx`, `LoginMobileInfo.tsx`, `AdminLoginPage.tsx`, `AdminLoginHero.tsx` | E2E spec green locally |
| A4 | Migrate `cloudflare-login.spec.ts` to testid/role anchors | `cloudflare-login.spec.ts` | tsc/lint |
| A5 | Blur audit: `pnpm build` + preview; remove 6 redundant `backdrop-blur-lg` iff blur visually persists | `LoginPage.tsx`, `AdminLoginPage.tsx`, `LoginHero.tsx`, `LoginMobileInfo.tsx`, `AdminLoginHero.tsx`, `AdminMobileInfo` | Visual browser check |
| A6 | Unit coverage: no-book state (notice visible, submit disabled, demo enabled, book present → enabled) | `LoginPage.test.tsx` | Coverage ≥ threshold |
| A7 | Quality gate + visual verification + push + merge #1028 | repo | All CI checks pass |

## 4. Preconditions

- Work happens on `feat/login-visual-overhaul` (current checkout), extending
  PR #1028. No rebase required (merge state CLEAN, main untouched since
  branch point e57c642).
- No auth/session logic modified; presentation-only changes per ADR-253.

## 5. Verification Plan

1. `pnpm vitest run` scoped: web auth feature tests + i18n parity.
2. `./scripts/minimal_quality_gate.sh` (lint + typecheck).
3. Production build + `vite preview`; browser-drive `/login` (no book, with
   book) and `/admin/login`: verify glass blur, notice/disabled state, demo
   login button enabled, password toggle placement (ADR-249).
4. Push; watch PR checks; resolve threads; squash-merge when green.

## 6. Risks / Human-in-the-loop

- Chromatic will flag the removed utility classes + new notice as visual
  diffs — expected; accept baselines if the blur is verified present.
- If prod build loses blur without `backdrop-blur-lg` (Tailwind layering
  quirk), keep utilities and record why in this file instead of removing.

## 7. Execution Record (2026-08-22, branch `feat/login-visual-overhaul`)

- **A1 ✅** `LoginForm` gained `noBookContext?: boolean`: renders a
  `role="status"` notice (`login.noBookContext`) above the form and disables
  the submit button. `LoginPage` passes `noBookContext={!bookSlug}`. Demo
  login and recovery flows untouched.
- **A2 ✅** `login.noBookContext` added to **all 14 locale catalogs** (en,
  de, fr, es, ar, hi, it, ja, ko, nl, pt, ru, zh) — not just en/de/fr; i18n
  parity is CI-enforced across every catalog.
- **A3/A4 ✅** `data-testid` anchors added (`login-card`, `login-hero`,
  `login-mobile-info`, `admin-login-card`, `admin-login-hero`,
  `admin-mobile-info`); `cloudflare-login.spec.ts` migrated off class-name
  selectors.
- **A5 ✅ (root cause found — deeper than redundancy).** Removing
  `backdrop-blur-lg` alone was NOT sufficient: the Tailwind v4 lightningcss
  pipeline rewrites any literal `backdrop-filter` + `-webkit-backdrop-filter`
  pair down to the **-webkit- form only** (its bundled browser data marks the
  standard property unsupported; even an unresolvable `var()` value gets
  stripped). Chromium keeps glass via the alias, but **Firefox silently lost
  all backdrop blur in production** — this, not utility purging, is what the
  PR author's "production build" workaround chased; the added utilities were
  visually inert there. Fix: `restoreStandardBackdropFilter()` Vite plugin
  (`apps/web/vite.config.ts`, build-only) re-inserts the standard declaration
  beside every `-webkit-` twin in emitted CSS. Verified: built CSS carries
  4× standard + 4× webkit occurrences; computed style on
  `[data-testid="login-card"]` shows the translucent oklch glass background.
  Remove the plugin once lightningcss ships corrected data.
- **A6 ✅** `LoginPage.test.tsx`: Button mock forwards `disabled`; three
  pre-existing submit-flow tests pinned to `?book=my-book` (they exercised
  the dead-end path); three new guard tests. Web suite: **120 files /
  1310 tests green**; i18n parity + rendered-text suites green.
- **Gate ✅** `scripts/minimal_quality_gate.sh` passed (lint + typecheck +
  shellcheck). Visual verification: production build + preview, screenshots
  of both book states confirm notice/disabled vs chip/enabled rendering.

**Learning:** treat `-webkit-*` twins of modern CSS properties as
build-output contracts — assert them from `dist/assets/*.css` after any
Tailwind/lightningcss major bump; dev-server CSS never exposes this class of
regression.
