# GOAP-315 — View Transitions for Page Navigation

Issue: [#315](https://github.com/d-oit/do-epub-studio/issues/315) — CLOSED 2026-05-26 (COMPLETED)
Status: **Implemented on main; verified this sprint.**

## Goal

Wrap React Router navigation in the View Transitions API (AGENTS.md Tier 3)
with graceful degradation.

## ADR

- **Chosen (as implemented)**: `apps/web/src/components/ViewTransitionRoutes.tsx`
  wraps route application in `document.startViewTransition(cb)` when available,
  falling back to `cb()` directly otherwise (feature-detect, no polyfill).
  CSS in `globals.css:538-563` (`@layer view-transitions`):
  `::view-transition-old/new(root)` fade animations,
  `view-transition-name: prevent-flicker` for the bottom tab bar, and a
  `prefers-reduced-motion: reduce` block collapsing animations to 0.01 ms.
- **Rejected**: polyfill for older browsers (adds weight for a progressive-
  enhancement feature); a custom hook instead of a wrapper component
  (component form matches the router composition used in the app).

## Acceptance → Evidence

| Acceptance | Evidence |
|---|---|
| Page transitions use View Transitions API | `ViewTransitionRoutes.tsx:18-22` |
| Graceful degradation | `ViewTransitionRoutes.test.tsx` — "uses startViewTransition when API is available" / "degrades gracefully when startViewTransition is not available" |
| No layout shift during navigation | `prevent-flicker` named transition on persistent chrome (globals.css:549-556) |
| Reduced-motion respected | globals.css:558-563 + global reduced-motion block (:570+) |

## Effort

M (historical; verification only this sprint).
