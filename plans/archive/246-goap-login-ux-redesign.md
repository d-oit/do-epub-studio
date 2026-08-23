# GOAP-246: Login Page UX Redesign

**Date:** 2026-08-17
**Status:** COMPLETED
**Related:** ADR-244 (Amendments A–C), ADR-245, ADR-063, GOAP-239 (500-LOC splits)

## Goal

Redesign the reader and admin login screens: a best-practice show/hide
password toggle (eye icon + visible label), a dual-action demo option
(one-click + autofill), and richer app/usage info on desktop and mobile.
This plan has been fully implemented.

## Current Evidence

| Area | Evidence | Finding |
| --- | --- | --- |
| Toggle component | `packages/ui/src/input.tsx` | `Input` already implements the GOV.UK-style toggle (`showPasswordLabel`/`hidePasswordLabel`, `aria-controls`, `aria-expanded`) — it was never wired into a login page. |
| Unused i18n keys | `apps/web/src/i18n/en.ts:13-14` | `ui.showPassword` / `ui.hidePassword` existed in every catalog but had no caller. |
| Demo UX | `apps/web/src/features/auth/LoginPage.tsx` (DemoLoginBlock), ADR-244 Amendment C | One-click button + plaintext `email · password · slug` info line. |
| Info panel | `LoginPage.tsx` (hero section) | Desktop-only name + one-line description; nothing below `lg`. |
| File-size cap | `AdminLoginPage.tsx` (521 lines) | Pre-existing >500-LOC violation (AGENTS.md Tier 3; GOAP-239 policy). |
| Duplicate tests | `apps/web/src/__tests__/login-page.test.tsx` | Second, divergently-mocked login suite; maintenance burden. |

## Improvement Summary

1. Wire the password toggle into every auth password field; upgrade it to
   eye icon + text.
2. Replace the demo info line with "Try the demo" + "Fill demo credentials".
3. Add value-prop hero (desktop) and compact info card (mobile) to both
   screens.
4. Bring every touched file under 500 lines; delete the duplicate suite.
5. Add 17 i18n keys across 13 catalogs with real translations.

## TRIZ Analysis

### Contradiction 1

**Improving:** Reviewer control and trust (watch credentials flow through
the real form).
**Worsens:** Form architecture complexity (the reader form is uncontrolled
`useActionState` + `FormData`).
**TRIZ principles available:** Intermediary, skipping.
**Resolution:** Use an intermediary — refs — to write input values directly.
`FormData` reads `.value` at submit; no controlled conversion, no synthetic
events needed (credentials are public per ADR-244 Amendment C).

### Contradiction 2

**Improving:** Information richness of the login screen.
**Worsens:** Clutter and mobile viewport budget.
**TRIZ principles available:** Segmentation, condition separation.
**Resolution:** Segment by viewport — full hero on `lg+`, compact
feature-card below `lg`; identical i18n keys, two presentations.

## Decomposition

| # | Task | Files | Status |
| --- | --- | --- | --- |
| 1 | Eye/EyeOff icons + icon+text toggle + `pr-28` | `packages/ui/src/icons.tsx` (new), `input.tsx`, `index.ts` | ✅ |
| 2 | Reader hero + mobile info components | `features/auth/LoginHero.tsx` (new), `LoginMobileInfo.tsx` (new) | ✅ |
| 3 | Reader page restructure (toggle, dual demo, autofill refs) | `features/auth/LoginPage.tsx` | ✅ |
| 4 | Admin hero/mobile components + MFA extraction (≤500 LOC) | `features/admin/AdminLoginHero.tsx`, `AdminMfaForms.tsx` (new), `AdminLoginPage.tsx` | ✅ |
| 5 | i18n: +17/−4 keys × 13 catalogs, real translations | `apps/web/src/i18n/*.ts` | ✅ |
| 6 | Tests: update suites, delete duplicate, add unit + E2E | `LoginPage.test.tsx`, `AdminLoginPage.test.tsx`, `Input.test.tsx`, `apps/tests/*.spec.ts` | ✅ |
| 7 | Docs: ADR-245 + index rows | `plans/245-adr-login-ux-redesign.md`, `plans/ADR-INDEX.md` | ✅ |

## Verification

- `packages/ui` vitest: 145/145 pass (4 new toggle tests).
- `apps/web` auth/admin/help vitest: 157/157 pass (new: autofill, hero,
  toggle wiring, admin parity).
- `tsc --noEmit` clean for `web` and `ui`.
- E2E (demo-gated and ungated) updated: toggle round-trip, fill-credentials
  flow, desktop hero assertions.
- Quality gate run on the feature branch before commit.

## Lessons Learned

- TypeScript's `keyof typeof en` catalog mirroring turns "forgot a locale"
  into a compile error — the i18n step is self-verifying.
- Testing-library text matching: a decorative `→` appended inside an anchor
  breaks `getByText` exact matching and is read aloud by screen readers;
  keep link text as a single clean string.
- Hero and mobile variants rendering the same keys require `getAllByText`
  in tests.
