---
version: '2.0.0'
name: reader-ui-ux
description: >
  Build localized, accessible, premium reader/admin UI with 2026 design standards.
  Features glassmorphism, micro-interactions, spatial layouts, and adaptive design.
  Activate for React screens, component library work, or UX modernization.
category: workflow
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Skill: `reader-ui-ux` v2.0.0

Purpose: Deliver premium, intentional, localized, accessible reader/admin UX for `d.o. EPUB Studio` with 2026 modern standards.

## When to run

- Modifying reader/admin React screens, layout primitives, or shared UI components.
- Adding localization copy, accessibility improvements, or design polish.
- Building locale switchers, typography controls, comment panels, or navigation.
- Implementing glassmorphism, micro-interactions, or responsive layouts.

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

## Core Principles

1. **Token-First**: Always use design tokens, never hardcode values
2. **Motion with Purpose**: Animations enhance UX, not distract
3. **Accessibility Built-in**: WCAG 2.1 AA compliance minimum
4. **Responsive by Default**: Mobile-first approach
5. **Dark Mode Native**: All components work in all themes

## Workflow

1. **Define experience** – viewport-specific layout + theme rules
2. **Tokenize** – use semantic tokens from design system
3. **Animate** – purposeful micro-interactions with Framer Motion
4. **Localize** – add strings to `en/de/fr` catalogs
5. **Accessibility** – keyboard, ARIA, reduced motion
6. **State** – Zustand selectors, memoize heavy renders
7. **Observability** – log key UI actions with trace IDs
8. **Test** – Vitest/RTL + Playwright coverage

## Checklist

- [ ] Layout responsive (mobile/tablet/desktop) with fluid spacing
- [ ] Strings localized (en/de/fr) and Accept-Language header updated
- [ ] Error states use Global ErrorBoundary + inline alerts
- [ ] Async effects cancel via AbortController; cleanup implemented
- [ ] UI interactions include aria-labels + focus traps
- [ ] Reduced motion support implemented
- [ ] No hardcoded colors or values - all tokens
- [ ] Touch targets minimum 44px on mobile

## Anti-Slop Checklist

- [ ] No arbitrary shadows (use design tokens)
- [ ] No random gradients (use semantic colors)
- [ ] No glass effects without purpose (overlays only)
- [ ] Focus visible with clear rings
- [ ] Motion respects user preferences
- [ ] Loading states for async actions

## References

- `references/design-tokens.md` - Complete token specification
- `references/animation-guide.md` - Framer Motion patterns
- `references/regression-prevention.md` - Preventing visual regression
- `references/glassmorphism.md` - Glass effect implementation
- `../plans/008-design-tokens-v2.md` - Master token document
- `../plans/009-e2e-test-plan.md` - Test specifications
