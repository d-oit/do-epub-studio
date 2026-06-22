---
version: '2.1.0'
name: reader-ui-ux
description: >
  Build localized, accessible, premium reader/admin UI with 2026 design standards.
  Features OKLCH colors, View Transitions, scroll-aware components, and mutual exclusivity panels.
category: workflow
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Skill: `reader-ui-ux` v2.1.0

Purpose: Deliver premium, intentional, localized, accessible reader/admin UX for `d.o.EPUB Studio` with 2026 modern standards.

## When to run

- Modifying reader/admin React screens, layout primitives, or shared UI components.
- Adding localization copy, accessibility improvements, or design polish.
- Building locale switchers, typography controls, comment panels, or navigation.
- Implementing glassmorphism, micro-interactions, or responsive layouts.

## 2026 UI Standards

1. **OKLCH Color Space**: Use `oklch()` for all color tokens to ensure perceptually uniform lightness and support for wide-gamut P3 displays.
2. **View Transitions**: All major page navigations should use the View Transitions API (React Router v7 `viewTransition: true`).
3. **Scroll-Awareness**: Primary navigation and toolbars should respond to scroll direction (hide on scroll-down, show on scroll-up).
4. **Panel Mutual Exclusivity**: In complex interfaces like the Reader, ensure only one side panel or overlay is open at a time.
5. **App Shell**: Always provide a branded loading state via `AppShell` for initial auth resolution.

## Quick Reference

| Resource              | Location                              |
| --------------------- | ------------------------------------- |
| Design Tokens         | `plans/008-design-tokens-v2.md`       |
| Tailwind Config       | `apps/web/tailwind.config.js`         |
| Global Styles         | `apps/web/src/styles/globals.css`     |
| UI Components         | `apps/web/src/components/ui/`         |
| Animation Guide       | `references/animation-guide.md`       |
| Design Tokens Detail  | `references/design-tokens.md`         |
| Regression Prevention | `references/regression-prevention.md` |

## Workflow

1. **Define experience** – viewport-specific layout + theme rules
2. **Tokenize** – use semantic tokens (OKLCH) from design system
3. **Animate** – purposeful micro-interactions with Framer Motion + View Transitions
4. **Localize** – add strings to `en/de/fr` catalogs
5. **Accessibility** – keyboard, ARIA, reduced motion
6. **State** – Zustand selectors, handle mutual exclusivity
7. **Observability** – log key UI actions with trace IDs
8. **Test** – Vitest/RTL + Playwright coverage

## Checklist

- [ ] Layout responsive (mobile/tablet/desktop) with fluid spacing
- [ ] Strings localized (en/de/fr) and correctly typed
- [ ] View Transitions enabled for navigation
- [ ] Panels are mutually exclusive
- [ ] Scroll-aware behaviors implemented
- [ ] UI interactions include aria-labels + focus traps
- [ ] Reduced motion support implemented
- [ ] No hardcoded colors - all OKLCH tokens
- [ ] Touch targets minimum 44px on mobile
