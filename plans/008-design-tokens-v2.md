# Design Tokens v2.0 - 2026 Modern Standards

**Status**: Active  
**Version**: 2.0.0  
**Last Updated**: 2026-04-14  
**Related**: [reader-ui-ux skill](../.agents/skills/reader-ui-ux/SKILL.md)

## Overview

This document defines the complete design token system for d.o. EPUB Studio. These tokens are the single source of truth for all visual design decisions and must be used consistently across the application to prevent visual regression.

## Token Categories

### 1. Color Tokens

#### Background Colors

| Token                  | Light Mode | Dark Mode | CSS Variable                   | Usage                  |
| ---------------------- | ---------- | --------- | ------------------------------ | ---------------------- |
| `background`           | `#ffffff`  | `#0a0a0a` | `--color-background`           | Main app background    |
| `background-secondary` | `#f5f5f5`  | `#141414` | `--color-background-secondary` | Cards, panels          |
| `background-tertiary`  | `#e5e5e5`  | `#1f1f1f` | `--color-background-tertiary`  | Hover states, dividers |

#### Foreground Colors

| Token               | Light Mode | Dark Mode | CSS Variable                | Usage            |
| ------------------- | ---------- | --------- | --------------------------- | ---------------- |
| `foreground`        | `#171717`  | `#fafafa` | `--color-foreground`        | Primary text     |
| `foreground-muted`  | `#737373`  | `#a3a3a3` | `--color-foreground-muted`  | Secondary text   |
| `foreground-subtle` | `#a3a3a3`  | `#737373` | `--color-foreground-subtle` | Placeholder text |

#### Accent Colors

| Token            | Light Mode | Dark Mode | Usage                  |
| ---------------- | ---------- | --------- | ---------------------- |
| `accent`         | `#2563eb`  | `#3b82f6` | Primary actions, links |
| `accent-success` | `#10b981`  | `#34d399` | Success states         |
| `accent-warning` | `#f59e0b`  | `#fbbf24` | Warnings               |
| `accent-error`   | `#ef4444`  | `#f87171` | Errors                 |
| `accent-info`    | `#06b6d4`  | `#22d3ee` | Information            |

#### Border Colors

| Token          | Light Mode | Dark Mode | Usage           |
| -------------- | ---------- | --------- | --------------- |
| `border`       | `#e5e5e5`  | `#262626` | Default borders |
| `border-light` | `#f5f5f5`  | `#404040` | Subtle borders  |

### 2. Typography Tokens

#### Font Families

| Token          | Value                                         | Usage          |
| -------------- | --------------------------------------------- | -------------- |
| `font-display` | `Inter, system-ui, sans-serif`                | Headings, UI   |
| `font-body`    | `Inter, system-ui, -apple-system, sans-serif` | Body text      |
| `font-serif`   | `Georgia, Cambria, serif`                     | Reader content |
| `font-mono`    | `JetBrains Mono, Fira Code, monospace`        | Code           |

#### Font Sizes (Fluid)

| Token           | Value                      | Usage            |
| --------------- | -------------------------- | ---------------- |
| `text-hero`     | `clamp(2.5rem, 8vw, 4rem)` | Page titles      |
| `text-title`    | `clamp(1.5rem, 4vw, 2rem)` | Section headers  |
| `text-subtitle` | `1.25rem`                  | Subheaders       |
| `text-body`     | `1rem`                     | Body text        |
| `text-caption`  | `0.875rem`                 | Labels, captions |
| `text-small`    | `0.75rem`                  | Fine print       |

#### Line Heights

| Token             | Value  | Usage       |
| ----------------- | ------ | ----------- |
| `leading-tight`   | `1.1`  | Headlines   |
| `leading-snug`    | `1.25` | Subheadings |
| `leading-normal`  | `1.5`  | UI text     |
| `leading-relaxed` | `1.6`  | Body text   |

#### Font Weights

| Token           | Value | Usage     |
| --------------- | ----- | --------- |
| `font-normal`   | `400` | Body text |
| `font-medium`   | `500` | Emphasis  |
| `font-semibold` | `600` | Labels    |
| `font-bold`     | `700` | Headings  |

### 3. Spacing Tokens (8px Grid)

| Token      | Value            | Usage             |
| ---------- | ---------------- | ----------------- |
| `space-1`  | `0.25rem` (4px)  | Tight gaps        |
| `space-2`  | `0.5rem` (8px)   | Default gaps      |
| `space-3`  | `0.75rem` (12px) | Component padding |
| `space-4`  | `1rem` (16px)    | Section gaps      |
| `space-5`  | `1.25rem` (20px) | Medium padding    |
| `space-6`  | `1.5rem` (24px)  | Card padding      |
| `space-8`  | `2rem` (32px)    | Section padding   |
| `space-10` | `2.5rem` (40px)  | Large spacing     |
| `space-12` | `3rem` (48px)    | Page padding      |

### 4. Border Radius Tokens

| Token         | Value            | Usage           |
| ------------- | ---------------- | --------------- |
| `radius-sm`   | `0.375rem` (6px) | Buttons, inputs |
| `radius-md`   | `0.5rem` (8px)   | Cards, panels   |
| `radius-lg`   | `0.75rem` (12px) | Modals, dialogs |
| `radius-xl`   | `1rem` (16px)    | Large cards     |
| `radius-2xl`  | `1.5rem` (24px)  | Hero sections   |
| `radius-3xl`  | `2rem` (32px)    | Full cards      |
| `radius-full` | `9999px`         | Pills, avatars  |

### 5. Shadow Tokens

| Token             | Value                              | Usage             |
| ----------------- | ---------------------------------- | ----------------- |
| `shadow-sm`       | `0 1px 2px 0 rgba(0,0,0,0.05)`     | Subtle elevation  |
| `shadow`          | `0 1px 3px 0 rgba(0,0,0,0.1)`      | Default elevation |
| `shadow-md`       | `0 4px 6px -1px rgba(0,0,0,0.1)`   | Cards             |
| `shadow-lg`       | `0 10px 15px -3px rgba(0,0,0,0.1)` | Modals            |
| `shadow-xl`       | `0 20px 25px -5px rgba(0,0,0,0.1)` | Dropdowns         |
| `shadow-glass`    | `0 8px 32px rgba(0,0,0,0.12)`      | Glass panels      |
| `shadow-glass-lg` | `0 20px 60px rgba(0,0,0,0.15)`     | Floating UI       |

### 6. Animation Tokens

#### Timing Functions

| Token              | Value                               | Usage         |
| ------------------ | ----------------------------------- | ------------- |
| `ease-out-expo`    | `cubic-bezier(0.16, 1, 0.3, 1)`     | Smooth exit   |
| `ease-in-expo`     | `cubic-bezier(0.7, 0, 0.84, 0)`     | Smooth enter  |
| `ease-out-back`    | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bounce effect |
| `ease-in-out-expo` | `cubic-bezier(0.87, 0, 0.13, 1)`    | Symmetric     |

#### Duration

| Token              | Value   | Usage              |
| ------------------ | ------- | ------------------ |
| `duration-instant` | `50ms`  | Micro-interactions |
| `duration-fast`    | `150ms` | Hover states       |
| `duration-normal`  | `250ms` | Transitions        |
| `duration-slow`    | `350ms` | Page transitions   |
| `duration-slower`  | `400ms` | Complex animations |

### 7. Layout Tokens

| Token                 | Value            | Usage           |
| --------------------- | ---------------- | --------------- |
| `header-height`       | `3.5rem` (56px)  | Fixed header    |
| `sidebar-width`       | `16rem` (256px)  | Side navigation |
| `content-max-width`   | `48rem` (768px)  | Reading area    |
| `container-max-width` | `80rem` (1280px) | Page container  |

### 8. Breakpoint Tokens

| Token | Value    | Target           |
| ----- | -------- | ---------------- |
| `sm`  | `640px`  | Mobile landscape |
| `md`  | `768px`  | Tablet portrait  |
| `lg`  | `1024px` | Tablet landscape |
| `xl`  | `1280px` | Desktop          |
| `2xl` | `1536px` | Large desktop    |

## Glassmorphism System

### CSS Classes

```css
/* Light Mode Glass Panel */
.glass-panel {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

/* Dark Mode Glass Panel */
.dark .glass-panel {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* Glass Card */
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 1rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.glass-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
}
```

## Implementation

### Tailwind Config

All tokens are configured in `apps/web/tailwind.config.js` with the `extend` pattern:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        background: {
          /* tokens */
        },
        foreground: {
          /* tokens */
        },
        accent: {
          /* tokens */
        },
      },
      // ... other tokens
    },
  },
};
```

### CSS Variables

Global CSS variables are defined in `apps/web/src/styles/globals.css`:

```css
:root {
  --color-background: #ffffff;
  --color-foreground: #171717;
  --color-accent: #2563eb;
  /* ... etc */
}

.dark {
  --color-background: #0a0a0a;
  --color-foreground: #fafafa;
  --color-accent: #3b82f6;
  /* ... etc */
}
```

## Regression Prevention

### Do's

- ✅ Always use design tokens via Tailwind classes
- ✅ Use `bg-background` instead of `bg-white` or `bg-black`
- ✅ Use `text-foreground` instead of `text-gray-900`
- ✅ Reference this document when adding new components
- ✅ Update this document when adding new tokens

### Don'ts

- ❌ Never hardcode colors in component files
- ❌ Never use arbitrary Tailwind values (e.g., `bg-[#123456]`)
- ❌ Never mix old and new color tokens
- ❌ Never bypass the token system for "one-off" designs

### Checklist for New Components

- [ ] Uses semantic color tokens (`background`, `foreground`, `accent`)
- [ ] Uses spacing tokens (multiples of 0.25rem)
- [ ] Uses border radius tokens
- [ ] Uses shadow tokens
- [ ] Supports dark mode automatically
- [ ] Respects reduced motion preferences
- [ ] Touch targets are minimum 44px

## Version History

| Version | Date       | Changes                              |
| ------- | ---------- | ------------------------------------ |
| 2.0.0   | 2026-04-14 | Complete redesign for 2026 standards |
| 1.0.0   | 2025-01-15 | Initial token system                 |

## Related Documents

- [reader-ui-ux skill](../.agents/skills/reader-ui-ux/SKILL.md)
- [coding-guide.md](coding-guide.md)
- [ADR-006: EPUB Rendering](../plans/006-epub-rendering-annotations.md)
