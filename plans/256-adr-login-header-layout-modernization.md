# ADR-256: Login Header Layout Modernization and Responsive Flex Contract

**Date:** Current session
**Status:** Accepted
**Deciders:** Project maintainer, product owner
**Related:** ADR-245, ADR-249, ADR-253, GOAP-254

## Context

The authentication pages (`/login`, `/admin/login`, and `/admin/recover`) place global language (`LocaleSwitcher`) and theme controls (`ThemeToggle`) in the upper header area. Previously, the `LoginHeader` component relied on fixed overlay positioning (`fixed right-3 top-3`), which caused layout collisions, overlapping of hero/card content, and horizontal clipping when viewports were narrow or when localized language labels were longer.

To ensure visual hierarchy, clear focus indicators, and horizontal alignment across all supported viewports, a dedicated responsive login-header container in natural layout flow is required.

## Decision

Modernize `LoginHeader` (`apps/web/src/components/LoginHeader.tsx`) to use a responsive, semantic `<header>` container in standard document flow instead of fixed positioning:

1. **Semantic Container & Flow Layout:**
   - Render `LoginHeader` as a semantic `<header>` element occupying normal top-level layout flow (`relative w-full max-w-7xl mx-auto px-4 pt-4 sm:px-6 lg:px-8 z-20`).
   - Remove fixed overlay positioning (`fixed right-3 top-3`) from the component.

2. **Responsive Controlled Wrapping & Stacking:**
   - Wrap theme and locale controls in a flex layout (`flex flex-wrap items-center justify-end gap-2 sm:gap-3`).
   - Below narrow breakpoints or when long translated locale labels are present, allow controlled flex wrapping/stacking without introducing horizontal overflow (`overflow-x-clip`) or edge collisions.

3. **Accessibility & Visual Hierarchy:**
   - Ensure all controls retain explicit focus rings (`focus-visible:ring-2 focus-visible:ring-accent outline-none`).
   - Maintain full RTL (`dir="rtl"`) direction support, allowing `justify-end` and flex alignment to naturally mirror without clipping or overlap.
   - Preserve existing dark/light theme switching behavior and interactive contracts.

4. **Reuse across Auth & Admin Surfaces:**
   - Share `LoginHeader` consistently across `/login`, `/admin/login`, and `/admin/recover`.
   - Update main content containers (`<main>`) to use `flex-1` flex-column page wrappers without hardcoded fixed-header top offset padding (`pt-16`).

## Alternatives Considered

### Retaining Fixed Overlay Positioning (`fixed right-3 top-3`)

Rejected because fixed overlay controls float above normal document flow and cause severe visual collisions with hero text, login cards, and headers on narrow viewports or under RTL/long-label translations.

### Absolutely Positioned Header Controls

Rejected because absolute positioning still detaches the controls from normal document layout flow, risking content collision and requiring brittle responsive offset adjustments per breakpoint.

## Acceptance Criteria

- `LoginHeader` renders a semantic `<header>` element with responsive flex wrapping layout in normal page flow.
- Header controls never overlap the login hero, card content, or viewport edges in the supported viewport matrix (`320px` to `1920px`).
- The login layout handles long locale names and RTL direction without horizontal scrollbar or overflow.
- Keyboard navigation, touch targets, and accessible names remain fully intact.
- Unit test coverage in `LoginHeader.test.tsx` validates container semantics, flex wrap attributes, and prop merging.
