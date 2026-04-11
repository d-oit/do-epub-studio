---
version: '1.0.0'
name: reader-ui-ux
description: >
  Build localized, accessible reader/admin UI with responsive layouts,
  telemetry, and Zustand integration. Activate for React screens or UX polish.
category: workflow
allowed-tools: Read Write Edit Grep Glob
license: MIT
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
- Reference: https://github.com/d-oit/do-gemini-ui-ux-skill/tree/main/

## Design Tokens Reference

Per [do-gemini-ui-ux-skill docs/design/](https://github.com/d-oit/do-gemini-ui-ux-skill/tree/main/docs/design):

| Token                | Usage                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| `colors.surface`     | App: `#050505`, Game: `#18181b`, Technical: `#E4E3E0`                     |
| `colors.semantic`    | Success: `#00FF00`, Warning: `#FFD700`, Error: `#FF4444`, Info: `#00D1FF` |
| `fontFamily.display` | Anton (hero/section headers)                                              |
| `fontFamily.serif`   | Georgia Italic (section subheaders)                                       |
| `fontFamily.body`    | Inter (body text)                                                         |
| `borderRadius.app`   | `2rem` (standard UI)                                                      |
| `borderRadius.game`  | `0.125rem` (minimal)                                                      |

## Gotchas (per external skill)

- **Mobile overflow**: Always use `overflow-x-auto` for horizontal navigation, `overflow-x-hidden` on root
- **Z-index wars**: Avoid absolute positioning for core layout; use flow-based (Flexbox/Grid)
- **Flickering UI**: Use `AnimatePresence` with `mode="wait"` and `initial={false}`; add `.anti-flicker` class to animated elements
- **Scrollbar jitter**: Use `overflow-x-hidden` on root, `overflow-y-auto` for content containers

## Anti-Slop Checklist

Before finalizing UI, verify:

- [ ] No arbitrary shadows (use borders + spacing instead)
- [ ] No gradients (use solid, semantic colors)
- [ ] No glass effects (avoid `backdrop-blur` unless intentional)
- [ ] Focus visible (use clear ring, not glow)
- [ ] No generic "SaaS blue" - use semantic tokens

## Workflow

1. **Define experience** – confirm viewport-specific layout (mobile drawer vs desktop side panels) + theme rules.
2. **Tokenize** – use semantic tokens from Tailwind config (surface, semantic, fontFamily.\*).
3. **Localization** – add strings to `en/de/fr` catalogs, ensure fallback, surface locale switcher.
4. **Accessibility** – keyboard focus, ARIA labels, reduced motion, semantic regions.
5. **State** – use Zustand selectors, avoid prop drilling, memoize heavy renders.
6. **Observability** – log key UI actions (book open, comment create) with trace IDs.
7. **Testing** – add Vitest/RTL for components; Playwright coverage for primary flows (login, reader, admin list).

## Checklist

- [ ] Layout responsive (mobile/tablet/desktop) with deliberate spacing/backgrounds (no flat white default unless spec says so).
- [ ] Strings localized (en/de/fr) and Accept-Language header updated.
- [ ] Error states use Global ErrorBoundary + inline alerts.
- [ ] Async effects cancel via AbortController; cleanup functions implemented to prevent leaks.
- [ ] UI interactions include aria-labels + focus traps where applicable.
- [ ] Anti-flicker class applied to animated/transformed elements.
- [ ] Horizontal navigation uses `overflow-x-auto`.
