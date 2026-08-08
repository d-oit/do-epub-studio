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
2. **View Transitions**: All major page navigations should use the View Transitions API (React Router v7 `viewTransition: true`). Assign `view-transition-name: prevent-flicker` to Sidebar and BottomTabBar to prevent nav flickering during page transitions — exclude them from root cross-fade with `animation: none` in `@view-transition`.
3. **Scroll-Awareness**: Primary navigation and toolbars should respond to scroll direction (hide on scroll-down, show on scroll-up).
4. **Panel Mutual Exclusivity**: In complex interfaces like the Reader, ensure only one side panel or overlay is open at a time.
5. **App Shell**: Always provide a branded loading state via `AppShell` for initial auth resolution.

## Quick Reference

| Resource              | Location                              |
| --------------------- | ------------------------------------- |
| Design Tokens         | `plans/archive/008-design-tokens-v2.md` |
| Global Styles         | `apps/web/src/styles/globals.css`     |
| UI Components         | `apps/web/src/components/ui/`         |
| Animation Guide       | `references/animation-guide.md`       |
| Design Tokens Detail  | `references/design-tokens.md`         |
| Regression Prevention | `references/regression-prevention.md` |

## Impeccable Commands (design vocabulary)

Use Impeccable for all UI work. Project tokens (`globals.css`) are authoritative.

| Command | When |
|---------|------|
| `/impeccable craft <Comp>` | New component: shape → build → iterate |
| `/impeccable audit <area>` | Technical quality: a11y, performance, responsive |
| `/impeccable polish <area>` | Final pass before shipping |
| `/impeccable critique <area>` | UX review: hierarchy, clarity, emotion |
| `/impeccable shape <area>` | Plan UX/UI before writing code |
| `/impeccable harden <area>` | Error handling, i18n, text overflow |
| `/impeccable adapt <area>` | Responsive/device adaptation |
| `/impeccable optimize <area>` | Performance improvements |

CI: `npx impeccable detect --json .` runs in quality gate. See `DESIGN.md` for anti-patterns.

## Workflow

1. **Define experience** – viewport-specific layout + theme rules
2. **Tokenize** – use semantic tokens (OKLCH) from design system
3. **Shape** – `/impeccable shape` to plan UX/UI
4. **Animate** – purposeful micro-interactions with CSS keyframes + View Transitions
5. **Localize** – add strings to `en/de/fr` catalogs
6. **Accessibility** – keyboard, ARIA, reduced motion
7. **State** – Zustand selectors, handle mutual exclusivity
8. **Audit** – `/impeccable audit` before merge
9. **Test** – Vitest/RTL + Playwright coverage
10. **Polish** – `/impeccable polish` final pass

## Checklist

- [ ] Layout responsive (mobile/tablet/desktop) with fluid spacing
- [ ] Strings localized (en/de/fr) and correctly typed
- [ ] View Transitions enabled for navigation (with `prevent-flicker` on nav containers)
- [ ] Panels are mutually exclusive
- [ ] Scroll-aware behaviors implemented
- [ ] UI interactions include aria-labels + focus traps
- [ ] Reduced motion support implemented
- [ ] No hardcoded colors - all OKLCH tokens
- [ ] Touch targets minimum 44px on mobile

## Performance Patterns

- **Parser timeout:** EPUB content parsing must have a timeout/budget to prevent infinite loops on malformed input.
- **Parallel preload:** Use `Promise.all` for spine/chapter operations to reduce load time.
- **Search virtualization:** Lists with >50 items must use the `VirtualList` component for smooth scrolling.
- **No `dark:` utilities:** Semantic tokens already adapt to dark/sepia themes via `globals.css` CSS variables. Avoid redundant `dark:` Tailwind prefixes.
