# Design Tokens Reference

Complete design token specification for 2026 standards.

## Color Tokens

### Background Colors

| Token | Light Mode | Dark Mode | CSS Variable | Usage |
|-------|------------|-----------|--------------|-------|
| `bg-primary` | `#ffffff` | `#0a0a0a` | `--color-background` | Main backgrounds |
| `bg-secondary` | `#f5f5f5` | `#141414` | `--color-background-secondary` | Cards, panels |
| `bg-tertiary` | `#e5e5e5` | `#1f1f1f` | `--color-background-tertiary` | Hover states, borders |

### Foreground Colors

| Token | Light Mode | Dark Mode | CSS Variable | Usage |
|-------|------------|-----------|--------------|-------|
| `text-primary` | `#171717` | `#fafafa` | `--color-foreground` | Primary text |
| `text-muted` | `#737373` | `#a3a3a3` | `--color-foreground-muted` | Secondary text |
| `text-subtle` | `#a3a3a3` | `#737373` | `--color-foreground-subtle` | Placeholder text |

### Accent Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `accent` | `#2563eb` | `#3b82f6` | Primary actions, links |
| `accent-success` | `#10b981` | `#34d399` | Success states |
| `accent-warning` | `#f59e0b` | `#fbbf24` | Warnings |
| `accent-error` | `#ef4444` | `#f87171` | Errors |

## Typography Scale

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-hero` | `clamp(2.5rem, 8vw, 4rem)` | `1.1` | Page titles |
| `text-title` | `clamp(1.5rem, 4vw, 2rem)` | `1.2` | Section headers |
| `text-subtitle` | `1.25rem` | `1.4` | Subheaders |
| `text-body` | `1rem` | `1.6` | Body text |
| `text-caption` | `0.875rem` | `1.5` | Labels, captions |

## Spacing Scale (8px Grid)

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | `0.25rem` (4px) | Tight gaps |
| `space-2` | `0.5rem` (8px) | Default gaps |
| `space-3` | `0.75rem` (12px) | Component padding |
| `space-4` | `1rem` (16px) | Section gaps |
| `space-6` | `1.5rem` (24px) | Card padding |
| `space-8` | `2rem` (32px) | Section padding |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | `0.375rem` | Buttons, inputs |
| `radius-md` | `0.5rem` | Cards, panels |
| `radius-lg` | `0.75rem` | Modals, dialogs |
| `radius-xl` | `1rem` | Large cards |
| `radius-2xl` | `1.5rem` | Hero sections |

## Shadow Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 2px 0 rgba(0,0,0,0.05)` | Subtle elevation |
| `shadow` | `0 1px 3px 0 rgba(0,0,0,0.1)` | Default elevation |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | Cards |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | Modals |
| `shadow-glass` | `0 8px 32px rgba(0,0,0,0.12)` | Glass panels |

## Animation Timing

### Easing Functions

| Token | Value | Usage |
|-------|-------|-------|
| `ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Smooth exit |
| `ease-in-out-expo` | `cubic-bezier(0.87, 0, 0.13, 1)` | Symmetric |
| `ease-out-back` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bounce effect |

### Duration

| Token | Value | Usage |
|-------|-------|-------|
| `duration-fast` | `150ms` | Hover states |
| `duration-normal` | `250ms` | Transitions |
| `duration-slow` | `350ms` | Page transitions |

## Breakpoints

| Token | Value | Target |
|-------|-------|--------|
| `sm` | `640px` | Mobile landscape |
| `md` | `768px` | Tablet portrait |
| `lg` | `1024px` | Tablet landscape |
| `xl` | `1280px` | Desktop |
