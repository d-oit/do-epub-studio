# Design Tokens Reference (2026 Modern Standards)

Complete design token specification for 2026 standards, using OKLCH color space.
All tokens are defined in `apps/web/src/styles/globals.css` and mapped to Tailwind v4 via `@theme`.

## Color Tokens (OKLCH)

OKLCH is preferred for its perceptually uniform lightness and wide-gamut P3 support.

### Background Colors (Tailwind: `bg-background`, `bg-background-secondary`, `bg-background-tertiary`)

| CSS Variable | OKLCH Value (Light) | Usage |
|--------------|---------------------|-------|
| `--color-background` | `oklch(100% 0 0)` | Main backgrounds |
| `--color-background-secondary` | `oklch(97% 0 0)` | Cards, panels |
| `--color-background-tertiary` | `oklch(92% 0 0)` | Hover states, borders |

### Foreground Colors (Tailwind: `text-foreground`, `text-foreground-muted`)

| CSS Variable | OKLCH Value (Light) | Usage |
|--------------|---------------------|-------|
| `--color-foreground` | `oklch(15% 0 0)` | Primary text |
| `--color-foreground-muted` | `oklch(40% 0 0)` | Secondary text |

### Accent Colors (Tailwind: `bg-accent`, `text-accent`, `border-accent`)

| CSS Variable | OKLCH Value (Light) | Wide Gamut (P3) |
|--------------|---------------------|-----------------|
| `--color-accent` | `oklch(48% 0.16 250)` | `oklch(52% 0.2 250)` |
| `--color-accent-success` | `oklch(70% 0.15 150)` | `oklch(70% 0.2 150)` |
| `--color-accent-warning` | `oklch(75% 0.15 80)` | `oklch(75% 0.2 80)` |
| `--color-accent-error` | `oklch(65% 0.2 25)` | `oklch(65% 0.25 25)` |

### Semantic Colors

| CSS Variable | Usage |
|--------------|-------|
| `--color-semantic-success` | Success states |
| `--color-semantic-warning` | Warning states |
| `--color-semantic-error` | Error states |
| `--color-semantic-info` | Info states |

## Motion & UI Logic

- **View Transitions**: Enabled for all navigations via `::view-transition-old(root)` / `::view-transition-new(root)`.
- **Scroll-Aware Toolbars**: Headers hide on scroll-down (`--motion-header-offset: -100px`) and show on scroll-up.
- **Panel Mutual Exclusivity**: Only one side panel (TOC, Settings, etc.) may be open at a time.
- **Micro-interactions**: CSS keyframe animations in `globals.css` (no framer-motion needed for standard patterns).
- **Reduced Motion**: Single consolidated `@media (prefers-reduced-motion: reduce)` block resets all motion variables.

## Typography Scale (fluid `clamp()`)

| CSS Variable | Size | Usage |
|--------------|------|-------|
| `--text-xs` | `clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)` | Captions, labels |
| `--text-sm` | `clamp(0.875rem, 0.8rem + 0.35vw, 1rem)` | Body small |
| `--text-base` | `clamp(1rem, 0.95rem + 0.25vw, 1.125rem)` | Body text |
| `--text-lg` | `clamp(1.125rem, 1rem + 0.75vw, 1.5rem)` | Subheaders |
| `--text-xl` | `clamp(1.5rem, 1.2rem + 1.25vw, 2.25rem)` | Page titles |
| `--font-display` | `Instrument Serif`, Georgia, serif | Editorial headings |

## Spacing (4px base)

| CSS Variable | Value |
|--------------|-------|
| `--space-1` | `0.25rem` |
| `--space-2` | `0.5rem` |
| `--space-3` | `0.75rem` |
| `--space-4` | `1rem` |
| `--space-6` | `1.5rem` |
| `--space-8` | `2rem` |
| `--space-12` | `3rem` |
| `--space-16` | `4rem` |

## Border Radius & Shadow

| CSS Variable | Value | Usage |
|--------------|-------|-------|
| `--radius-sm` | `0.375rem` | Small elements |
| `--radius-md` | `0.5rem` | Default components |
| `--radius-lg` | `0.75rem` | Cards, panels |
| `--radius-xl` | `1rem` | Floating panels |
| `--shadow-sm` | `0 1px 2px oklch(0.2 0.01 80 / 0.06)` | Subtle depth |
| `--shadow-md` | `0 4px 12px oklch(0.2 0.01 80 / 0.08)` | Cards |
| `--shadow-lg` | `0 12px 32px oklch(0.2 0.01 80 / 0.12)` | Modals |
| `--shadow-glass` | `0 4px 24px rgba(0, 0, 0, 0.08)` | Glass UI |

## Theme Variants

All tokens have light, dark, and sepia variants defined via:
- `:root` (light, default)
- `.dark` / `[data-theme="dark"]`
- `[data-theme="sepia"]`

No `dark:` Tailwind utilities are needed — semantic tokens automatically adapt.
