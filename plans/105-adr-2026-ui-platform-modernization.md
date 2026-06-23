# ADR-105: 2026 UI Platform Modernization Policy

**Date:** 2026-06-23
**Status:** Proposed
**Deciders:** Project maintainer
**Related:** ADR-079 (2026 Web Platform Standards), ADR-082b (Editorial UI), ADR-063a (Accessibility)

## Context

The codebase has a solid design token foundation (OKLCH, fluid type, motion
control, View Transitions) but does not use several 2026-baseline web platform
APIs that would reduce JS bundle size, improve responsiveness, and align
with the editorial minimalist direction. React 19 also ships patterns that
eliminate common boilerplate present in the current implementation.

## Decision

1. **Logical properties are mandatory** for all new CSS. Existing physical
   properties (`left`, `right`, `top`, `bottom` as direction) are converted
   incrementally. Exception: `transform: translateY()` and explicit
   layout offsets (e.g., `top: var(--header-height)`) may remain physical.

2. **Container queries replace media queries** for component-level
   responsiveness. All reader side-panels and admin data views must use
   `@container` rather than viewport breakpoints.

3. **Native `popover` attribute replaces JS-managed show/hide** for
   non-modal overlays (tooltips, menus, annotation toolbars). Modal
   dialogs continue to use `<dialog>` with `useFocusTrap`.

4. **Scroll-driven animations** are used for scroll-progress indicators.
   Must degrade gracefully (`@supports`) and respect
   `prefers-reduced-motion`.

5. **React 19 `use()` + Suspense** is the default pattern for async data
   in route-level pages. `useEffect`-based fetching is permitted only in
   non-Suspense-compatible contexts (e.g., polling intervals).

6. **`useOptimistic`** is adopted for any mutation where immediate UI
   feedback matters (annotations, bookmarks, comments).

7. **Anchor positioning** is adopted for the annotation toolbar once
   Baseline 2025 coverage is confirmed in the CI Playwright browsers.

## Consequences

- Reduced JS in component library (popover, tooltips shed JS handlers)
- Better RTL/i18n readiness (logical properties)
- Smaller data-fetching boilerplate (use() eliminates loading states)
- Requires Suspense `<ErrorBoundary>` + `<Suspense>` wrappers at route level
- Container queries need `container-type: inline-size` on parent elements
- All new patterns require `@supports` fallbacks for the popover and
  anchor-positioning features during the transition window

## Compliance

- Changes must pass WCAG 2.1 AA (semantic tokens per ADR-063a)
- No motion regressions (prefers-reduced-motion coverage)
- Lighthouse Performance ≥ 90
