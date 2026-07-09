# Design Language: d.o.EPUB Studio

## Direction
Editorial minimalist — inspired by book design, not SaaS dashboards. Clean typography, generous whitespace, muted palette with intentional color accents.

## Colors (OKLCH, per ADR-063a)
All colors use OKLCH for perceptually uniform lightness and P3 wide-gamut support. Semantic tokens are defined in `apps/web/src/styles/globals.css`:
- `--color-foreground`, `--color-background`, `--color-border`, etc.
- Status: `--color-accent-error`, `--color-muted`, `--color-accent`
- Light/dark/sepia themes via `.dark` and `[data-theme]` selectors

## Typography
- **Display/Headings:** `Instrument Serif` (via `--font-display` token) for editorial feel
- **Body:** `Geist` with `Inter` fallback, line-height 1.6+ — **committed pairing per Plan 115 U4** (Geist for modern sans-serif readability, Instrument Serif for editorial display)
- **Monospace:** For code/technical content only
- Type scale: fluid `clamp()` tokens (`--text-xs` through `--text-xl`)

## Layout
- Generous whitespace — content breathes
- CSS Grid / Flexbox for layout; no float hacks
- Container queries (`@container`) for responsive components (ADR-105)
- Logical properties where supported (`margin-inline`, `padding-block`)
- View Transitions API for page-to-page navigation

## Components (all shipped in `packages/ui`)
- Button, Card, Input, Modal, Toast, Tooltip, Badge, Skeleton, Spinner
- Pagination, ConfirmDialog, SearchInput, ProgressBar, Tabs

## Motion
- Subtle, purposeful transitions (`--ease-out-expo`, not bounce/elastic)
- `prefers-reduced-motion` respected everywhere (consolidated single block in `globals.css`)
- View Transitions for navigation, not decorative animation
- CSS-only animation keyframes (no framer-motion dependency in `globals.css`)

## Anti-Patterns (from Impeccable + anti-ai-slop)
- No purple-to-blue gradients
- No nested cards
- No gray text on colored backgrounds
- No pure black/gray (always tint)
- No bounce/elastic easing
- No Inter as the only font
- No rounded-square icon tile above every heading

## Accessibility
- WCAG 2.1 AA minimum (ADR-063a)
- Semantic design tokens for all colors
- axe-core assertions in component tests
- Keyboard navigation for all interactive elements
- Screen reader compatibility (LiveRegion component)

## Platform APIs (ADR-105)
- Native Popover API for tooltips/menus (with `@supports` fallback)
- Container Queries for responsive panels/tables
- `useOptimistic` / `useFormStatus` / `useActionState` for React 19 patterns
- Service Worker for offline PWA (ADR-005)

## Impeccable Integration
This project uses Impeccable for deterministic design quality checks:
- `npx impeccable detect --json .` runs in CI (quality gate)
- `/impeccable audit` for technical quality (a11y, performance, responsive)
- `/impeccable polish` for final shipping pass
- `/impeccable critique` for UX review
- Project tokens in `globals.css` are authoritative; Impeccable detects deviations
