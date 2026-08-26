# ADR-256: Login Header Layout Modernization

**Date:** 2026-08-26
**Status:** Accepted
**Deciders:** Core Engineering Team, UI/UX Working Group
**Related:** ADR-032 (UI/UX 2026), ADR-105 (2026 UI Platform Modernization), ADR-245 (Login Page UX Redesign)

## Context

The login, admin login, and admin password recovery screens place global locale and theme controls in the top-right header area. Previously, these controls were absolutely positioned using fixed offsets (`fixed right-3 top-3 z-20`).

On narrow viewports (<375px), when using localized strings with long locale names, or in RTL text flow, fixed positioning caused header controls to collide with or overlap page content (such as `LoginHero`, `LoginMobileInfo`, and the main login card), or overflow the viewport boundaries.

## Decision

We replace fixed control positioning across all authentication views (`LoginPage`, `AdminLoginPage`, `AdminRecoverPage`) with a dedicated, responsive `LoginHeader` container component:

1. **Dedicated Container Component (`LoginHeader`):**
   - Standardizes the encapsulation of `ThemeToggle` and `LocaleSwitcher`.
   - Uses normal flex layout (`w-full flex flex-wrap items-center justify-end gap-2 sm:gap-3`) allowing controlled wrapping without absolute element overlap or z-index collisions.

2. **Explicit Layout Boundaries:**
   - Placed at the top of the authentication view documents in standard element flow.
   - Adjusts main content height calculations (`min-h-[calc(100dvh-4rem)]` or `min-h-[calc(100dvh-6rem)]`) to prevent vertical content pushing or unintended document scrolling.

3. **Accessibility & Interactive Parity:**
   - Preserves focus rings, touch targets (min 44px), and keyboard navigation order.
   - Preserves existing dark/light theme behavior and i18n locale switching capabilities.

## Consequences

- **Pros:**
  - Header controls wrap cleanly under narrow viewports without overlapping hero content or cards.
  - Zero horizontal document overflow across all viewport dimensions in the viewport test matrix.
  - Standardized header control layout reusable across reader auth and admin auth routes.
- **Cons:**
  - Consumes vertical flow space at the top of the page on mobile viewports (handled via responsive spacing).

## Compliance & Verification

- Tested via unit test suite (`src/components/__tests__/LoginHeader.test.tsx`, `src/features/auth/LoginPage.test.tsx`, `src/features/admin/AdminLoginPage.test.tsx`, `src/__tests__/admin-recover-page.test.tsx`).
- Responsive E2E tests pass across mobile, tablet, and desktop viewports without horizontal overflow or geometry collisions.
