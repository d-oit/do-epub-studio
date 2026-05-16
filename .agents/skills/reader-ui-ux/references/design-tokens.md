# Design Tokens Reference (2026 Modern Standards)

Complete design token specification for 2026 standards, migrating to OKLCH color space.

## Color Tokens (OKLCH)

OKLCH is preferred for its perceptually uniform lightness and wide-gamut P3 support.

### Background Colors

| Token | OKLCH Value | HEX Fallback | Usage |
|-------|-------------|--------------|-------|
| `bg-primary` | `oklch(100% 0 0)` | `#ffffff` | Main backgrounds |
| `bg-secondary` | `oklch(97% 0 0)` | `#f5f5f5` | Cards, panels |
| `bg-tertiary` | `oklch(92% 0 0)` | `#e5e5e5` | Hover states, borders |

### Foreground Colors

| Token | OKLCH Value | HEX Fallback | Usage |
|-------|-------------|--------------|-------|
| `text-primary` | `oklch(15% 0 0)` | `#171717` | Primary text |
| `text-muted` | `oklch(55% 0 0)` | `#737373` | Secondary text |

### Accent Colors

| Token | OKLCH Value | HEX Fallback | Wide Gamut (P3) |
|-------|-------------|--------------|-----------------|
| `accent` | `oklch(60% 0.15 250)` | `#2563eb` | `oklch(60% 0.2 250)` |
| `accent-success` | `oklch(70% 0.15 150)` | `#10b981` | `oklch(70% 0.2 150)` |
| `accent-warning` | `oklch(75% 0.15 80)` | `#f59e0b` | `oklch(75% 0.2 80)` |
| `accent-error` | `oklch(65% 0.2 25)` | `#ef4444` | `oklch(65% 0.25 25)` |

## Motion & UI Logic

- **View Transitions**: Enabled for all navigations using React Router v7 future flags.
- **Scroll-Aware Toolbars**: Headers hide on scroll-down (y: -100px) and show on scroll-up.
- **Panel Mutual Exclusivity**: Only one side panel (TOC, Settings, etc.) may be open at a time.
- **Micro-interactions**: Use spring physics (`damping: 20`, `stiffness: 300`) for floating toolbars.

## Typography Scale

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-hero` | `clamp(2.5rem, 8vw, 4rem)` | `1.1` | Page titles |
| `text-title` | `clamp(1.5rem, 4vw, 2rem)` | `1.2` | Section headers |
| `text-subtitle` | `1.25rem` | `1.4` | Subheaders |
| `text-body` | `1rem` | `1.6` | Body text |

## Border Radius & Shadow

| Token | Value | Usage |
|-------|-------|-------|
| `radius-md` | `0.5rem` | Default components |
| `radius-xl` | `1rem` | Floating panels |
| `shadow-glass` | `0 8px 32px rgba(0,0,0,0.12)` | Glass UI |
| `shadow-glass-lg` | `0 20px 60px rgba(0,0,0,0.15)` | Modals/Shell |
