# @do-epub-studio/ui

Shared React component library. Built on React 19 + Framer Motion 12. Each component is a self-contained module exported from `src/index.ts`.

## Component Catalog

| Component | File | Description |
|-----------|------|-------------|
| `Button` | `button.tsx` | Variants: primary, secondary, ghost, danger. Supports `asChild` via Slot |
| `Input` | `input.tsx` | Styled text input with error state, focus ring, label support |
| `Modal` | `modal.tsx` | Accessible dialog (`role="dialog"`, focus trap, `Escape` dismiss, `aria-modal`) |
| `Tooltip` | `tooltip.tsx` | Hover/focus tooltip with delay, arrow, and keyboard support |
| `Toast` | `toast.tsx` | Toast notification system via `ToastProvider` context |
| `Spinner` | `spinner.tsx` | Loading spinner with configurable size and color |
| `Badge` | `badge.tsx` | Status badge (variants: default, success, warning, error, info) |
| `Card` | `card.tsx` | Container card with optional padding and shadow controls |
| `Skeleton` | `skeleton.tsx` | Loading skeleton placeholder |
| `LiveRegion` | `LiveRegion.tsx` | Screen reader live region for dynamic announcements |
| `IconButton` | `icon-button.tsx` | Icon-only button with accessible label |
| `Header` | `header.tsx` | Page header with title and actions slot |
| `PageContainer` | `page-container.tsx` | Layout wrapper with max-width and padding |

## Animations

Reusable Framer Motion variants in `variants.ts`: `fadeVariants`, `slideUpVariants`, `slideDownVariants`, `scaleVariants`, `staggerContainerVariants`, `staggerItemVariants`. Respects `prefers-reduced-motion`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test:unit` | Vitest (jsdom, passWithNoTests) |
