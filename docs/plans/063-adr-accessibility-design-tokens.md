# ADR 063: Mandatory Accessible Contrast & Semantic Design Tokens

**Status:** ✅ Accepted
**Date:** 2026-06-04

## Context
Multiple accessibility violations were identified on the login pages due to insufficient color contrast (WCAG 2.1 AA failure). These issues were caused by using manual Tailwind color scales (e.g., `text-gray-700`) that did not account for the dark background's luminance.

## Decision
1. **Mandatory Semantic Tokens:** All UI components MUST use semantic design tokens defined in `apps/web/src/styles/globals.css` (e.g., `text-foreground`, `text-foreground-muted`, `bg-background`, `border-border`) rather than numeric Tailwind scales for primary text and surfaces.
2. **WCAG 2.1 AA Compliance:** Any new UI change MUST be verified against WCAG 2.1 AA contrast requirements (4.5:1 for normal text, 3:1 for large text and UI components).
3. **Contrast Verification:** For any non-standard color combinations, a contrast check script MUST be run as part of the verification process.

## Consequences
- Improved accessibility for all users, especially those with low vision or color vision deficiencies.
- Better consistency across the application's themes (Light, Dark, Sepia).
- Simplified maintenance of colors through a central source of truth in `globals.css`.
- Slight increase in development time for verification of new UI patterns.
