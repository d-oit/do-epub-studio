# Accessibility Guide

**Target:** WCAG 2.1 Level AA compliance across all user-facing surfaces.

## Principles

1. **Perceivable** — content is presentable in ways all users can perceive
2. **Operable** — UI components are navigable via keyboard, assistive tech, and touch
3. **Understandable** — content and controls behave predictably
4. **Robust** — content works with current and future assistive technologies

## Testing

### Automated (axe-core)

E2E accessibility audits run against every major page in
`apps/tests/accessibility-audit.spec.ts`:

- Login page
- Reader view
- Settings panel
- Table of Contents
- Admin login, books, grants, audit pages

Run audits locally:

```bash
pnpm test:e2e --grep "accessibility"
```

### Manual

- **Keyboard navigation** — Tab through all interactive elements; focus must be
  visible and follow a logical order.
- **Screen reader** — Test with VoiceOver (macOS), NVDA (Windows), or Orca (Linux).
- **Zoom** — Content must reflow at 200% zoom without horizontal scrolling.

## Patterns

### Focus Management

- `useFocusTrap` (packages/ui) — traps focus inside modal panels (TOC, Settings,
  Comments, Bookmarks)
- `SkipToContent` link — first focusable element on every page; jumps to
  `#main-content`
- Focus is restored to the triggering element when a panel closes

### ARIA Landmarks

The app shell uses semantic landmarks:

- `<header>` — mobile top bar
- `<nav>` — Sidebar (desktop) and BottomTabBar (mobile)
- `<main id="main-content">` — primary content area
- `<aside>` — reader side-panels (TOC, Comments, Settings)

### Live Regions

`LiveRegion` component (packages/ui) announces dynamic content changes:

- Panel open/close transitions
- Offline/online status changes
- Error messages and toast notifications

### Color & Contrast

- All colors use OKLCH design tokens from `globals.css`
- Minimum 4.5:1 contrast for normal text, 3:1 for large text (WCAG AA)
- Semantic states (success, error, warning) include icon or text reinforcement
  — not color alone

### Touch Targets

- Minimum 44×44px for all interactive elements
- `.touch-target` utility class available in `globals.css`
- Navigation items, toolbar buttons, and form controls all meet minimum size

### Reduced Motion

- `globals.css` respects `prefers-reduced-motion: reduce` by setting
  `animation-duration: 0.01ms` and `transition-duration: 0.01ms`
- CSS animations and transitions are disabled; JS animations should check
  `window.matchMedia('(prefers-reduced-motion: reduce)')`

## RTL Support

RTL (right-to-left) layout is planned but not yet implemented. The i18n
infrastructure supports `direction` prop on reader components. See
Plan 063 Wave 3 (F6, I3) for tracking.

## References

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- Coding guide §8 — Accessibility architecture decisions
