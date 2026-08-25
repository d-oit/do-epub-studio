---
version: '1.0.0'
name: frontend-design
description: >
  Apply frontend design best practices: layout planning, OKLCH design tokens, responsive component architecture, View Transitions, and budget validation.
category: workflow
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Skill: `frontend-design` v1.0.0

Purpose: Standardize frontend UI design, layout architecture, OKLCH design token usage, component modularity, and budget compliance for `d.o.EPUB Studio`.

## When to Run

- Planning or scaffolding new frontend layouts, screens, or UI feature components.
- Standardizing design tokens (`globals.css`), Tailwind CSS integration, or fluid typography/spacing.
- Designing responsive component architecture using Container Queries (`@container`) and CSS Grid/Flexbox.
- Validating performance budgets (`.performance-budgets.json`, `bundle-baseline.json`, Lighthouse CI) before proposing UI changes.

## Skill Delegations & Scope Boundaries

To prevent duplication across skills, delegate domain-specific concerns as follows:
- **Deep WCAG / Accessibility Audits** → `accessibility-auditor`
- **EPUB Reader / Admin UX Interactivity** → `reader-ui-ux`
- **Visual Polish & Design System Enforcement** → `impeccable`
- **PWA & Offline Data Syncing** → `pwa-offline-sync`

## Core Principles

1. **Layout Planning Before Code**: Define viewport structure, grid/flex layouts, and container hierarchy before component implementation.
2. **Project Token Alignment**: All color definitions must use `oklch()` design tokens from `apps/web/src/styles/globals.css`. Never hardcode colors or hex values.
3. **Editorial Minimalist Aesthetic**: Adhere to `DESIGN.md` — clean typography (`Instrument Serif` headings, `Geist`/`Inter` body), generous whitespace, muted palette with intentional accents.
4. **Platform-First APIs**: Utilize Container Queries (`@container`), Native Popover API, CSS Grid, and View Transitions API (`viewTransition: true`).
5. **Performance & Budget Respect**: Ensure changes satisfy `.performance-budgets.json`, `bundle-baseline.json`, and Lighthouse CI targets.

## Workflow

1. **Layout Plan & Wireframe**: Map layout structure across desktop, tablet, and mobile viewports.
2. **Token & Style Mapping**: Identify required semantic design tokens (`--color-background`, `--color-foreground`, `--color-accent`, etc.).
3. **Component Structuring**: Build reusable, modular React components using `@do-epub-studio/ui` primitives.
4. **Responsive & Container Query Integration**: Apply container query classes (`@container`, `@md:`, etc.) for container-relative styling.
5. **Motion & Transitions**: Add subtle CSS transitions and View Transitions for page-level navigation without heavy animation libraries.
6. **Budget & Quality Verification**: Validate against performance budgets and run design/quality gates.

## Quick Reference

| Resource | Location |
| --- | --- |
| Design Language & Rules | `DESIGN.md` |
| Global Styles & Tokens | `apps/web/src/styles/globals.css` |
| UI Component Library | `packages/ui/` |
| Performance Budgets | `.performance-budgets.json` |
| Bundle Baseline | `bundle-baseline.json` |

## Reference Guides

- `references/layout-and-tokens.md` — Layout planning guidelines and OKLCH token mapping.
- `references/component-architecture.md` — Responsive component patterns, container queries, and View Transitions.
- `references/performance-and-budgets.md` — Performance budget limits, Lighthouse CI integration, and bundle auditing.
