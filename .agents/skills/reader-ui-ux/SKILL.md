---
version: "1.0.0"
name: reader-ui-ux
description: Build localized, accessible reader/admin experiences with responsive layouts, telemetry, and Zustand integration.
---

# Skill: `reader-ui-ux`

Purpose: deliver intentional, localized, accessible reader/admin UX for `do EPUB Studio`.

## When to run

- Modifying reader/admin React screens, layout primitives, or shared UI components.
- Adding localization copy, accessibility improvements, or design polish.
- Building locale switchers, typography controls, or comment panels.

## Inputs

- `docs/coding-guide.md` §20 (Frontend design rules)
- Tailwind config + design tokens
- Localization catalogs (`apps/web/src/i18n`)

## Workflow

1. **Define experience** – confirm viewport-specific layout (mobile drawer vs desktop side panels) + theme rules.
2. **Localization** – add strings to `en/de/fr` catalogs, ensure fallback, surface locale switcher.
3. **Accessibility** – keyboard focus, ARIA labels, reduced motion, semantic regions.
4. **State** – use Zustand selectors, avoid prop drilling, memoize heavy renders.
5. **Observability** – log key UI actions (book open, comment create) with trace IDs.
6. **Testing** – add Vitest/RTL for components; Playwright coverage for primary flows (login, reader, admin list).

## Checklist

- [ ] Layout responsive (mobile/tablet/desktop) with deliberate spacing/backgrounds (no flat white default unless spec says so).
- [ ] Strings localized (en/de/fr) and Accept-Language header updated.
- [ ] Error states use Global ErrorBoundary + inline alerts.
- [ ] Async effects cancel via AbortController; cleanup functions implemented to prevent leaks.
- [ ] UI interactions include aria-labels + focus traps where applicable.
