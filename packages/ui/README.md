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
| `pnpm storybook` | Start Storybook dev server on port 6006 |
| `pnpm build:storybook` | Build static Storybook to `storybook-static/` |

## Storybook

Interactive component documentation runs at `http://localhost:6006`.

### Available Stories

| Component | Story File |
|-----------|-----------|
| Badge | `Badge.stories.tsx` |
| Button | `Button.stories.tsx` |
| Card | `Card.stories.tsx` |
| Header | `Header.stories.tsx` |
| IconButton | `IconButton.stories.tsx` |
| Input | `Input.stories.tsx` |
| LiveRegion | `LiveRegion.stories.tsx` |
| Modal | `Modal.stories.tsx` |
| PageContainer | `PageContainer.stories.tsx` |
| Skeleton | `Skeleton.stories.tsx` |
| Toast | `Toast.stories.tsx` |
| Tooltip | `Tooltip.stories.tsx` |

### Writing Stories

Use [CSF3 format](https://storybook.js.org/docs/writing-stories) with `tags: ['autodocs']`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../badge';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: 'Active', variant: 'default' },
};
```

### Conventions

- One story file per component, matching the component file name
- Cover all variants (default, destructive, outline, ghost)
- Cover states (default, disabled, loading)
- Use `argTypes` for interactive controls
- Test accessibility with the a11y addon (`@storybook/addon-a11y`)
- All design tokens use OKLCH from `globals.css`

### CI Integration

Stories are tested in CI via:
1. **Visual regression** — Chromatic snapshots (`visual-regression.yml`)
2. **Accessibility** — axe-core checks via the a11y addon
3. **Storybook build** — verified in the `Build` CI job
