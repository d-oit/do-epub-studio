# Plan 008: Design Tokens v2.1.0 (2026 Standards)

**Status:** Accepted
**Date:** 2026-05-16

---

## 1. Color System (OKLCH & P3)

The system has migrated to **OKLCH** for perceptually uniform color mixing and **Wide Gamut P3** support.

### Semantic Tokens (Light Mode)

| Token | OKLCH Value | HEX Fallback | Usage |
|-------|-------------|--------------|-------|
| `background` | `oklch(100% 0 0)` | `#ffffff` | Main background |
| `background-secondary` | `oklch(97% 0 0)` | `#f5f5f5` | Panels, cards |
| `foreground` | `oklch(15% 0 0)` | `#171717` | Main text |
| `accent` | `oklch(60% 0.15 250)` | `#2563eb` | Primary actions |

### Wide Gamut P3 (Conditional)

Supported devices receive richer colors via `@media (color-gamut: p3)`:
- `accent`: `oklch(60% 0.2 250)`
- `accent-error`: `oklch(65% 0.25 25)`

## 2. Motion & Transitions

- **View Transitions**: enabled by default for all page navigations.
- **Header Auto-hide**: Headers hide on scroll-down and show on scroll-up.
- **Glassmorphism**: Use `glass-panel` and `glass-card` for floating UI.

## 3. Reader Standards

- **Panel Mutual Exclusivity**: Only one reader side-panel can be open at once.
- **Progress Visibility**: Reading progress must be visible in the primary toolbar.
- **Annotation Micro-interactions**: Scale-in animations for floating annotation toolbars.

## 4. Implementation Details

Tokens are defined in `apps/web/src/styles/globals.css` using CSS variables and exposed via Tailwind v4 `@theme` block.

```css
@theme {
  --color-accent: var(--color-accent);
  /* ... */
}
```

---
*Updated for 2026 UI/UX Modernization.*
