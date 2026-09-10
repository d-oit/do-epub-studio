# Regression Prevention

Guidelines to prevent visual and functional regression.

## Design Token Lock

Design tokens are the single source of truth. **Never** deviate without updating the token documentation.

**Reference Documents:**
- `plans/archive/008-design-tokens-v2.md` - Complete token specification
- `apps/web/src/styles/globals.css` - CSS variable definitions (Tailwind v4 `@theme` block)

## Pre-Commit Checklist

- [ ] **No Hardcoded Values**: No hex colors, pixel values, or arbitrary sizes
- [ ] **Token Usage**: All colors use `bg-*`, `text-*`, `border-*` from tokens
- [ ] **Dark Mode**: All components render correctly in dark mode
- [ ] **Responsive**: Layouts work from 320px to 2560px
- [ ] **Motion**: Respects `prefers-reduced-motion`
- [ ] **Accessibility**: Touch targets min 44px, focus visible, ARIA labels
- [ ] **Password toggle placement**: Show/hide controls are anchored to the documented **trailing/logical inline-end edge** (ADR-249), with matching end-side input padding and RTL-safe logical positioning
- [ ] **Dark mode via tokens, never `dark:` utilities**: the repo has no `@custom-variant dark`, so `dark:` compiles to `prefers-color-scheme` and never fires for the `.dark`/`[data-theme]` flip. Meet contrast with flipped semantic tokens (e.g. `bg-primary-700 text-background`), both themes ≥4.5:1
- [ ] **Grouping controls use native `fieldset`/`legend`** (W3C form grouping), legends styled `.eyebrow block`; labels not associated to a control don't announce
- [ ] **Container query placement**: the named `@container/x` container and its own width variants (`@md/x:`) must never share an element — a container cannot query itself; variants belong on descendants

## Forbidden Patterns

These patterns will cause CI failures:

```css
/* Forbidden: Hardcoded colors */
.custom-class { color: #ff0000; }

/* Forbidden: Arbitrary Tailwind values */
<div class="bg-[#123456] w-[123px]">

/* Forbidden: Inline styles */
<div style={{ color: 'red' }}>
```

## Allowed Patterns

```tsx
// Allowed: Token-based classes
<div className="bg-background text-foreground">

// Allowed: Dynamic tokens via class variance authority
import { cva } from 'class-variance-authority';
const button = cva('bg-accent text-white', {
  variants: { size: { sm: 'px-2', lg: 'px-4' } }
});
```

## Auth Control Placement Regression

For every password field with a visibility control, assert both behavior and geometry:

```typescript
const password = page.getByRole('textbox', { name: 'Password' });
const toggle = page.getByRole('button', { name: 'Show password' });
const passwordBox = await password.boundingBox();
const toggleBox = await toggle.boundingBox();
expect(passwordBox).not.toBeNull();
expect(toggleBox).not.toBeNull();
// Toggle lives on the trailing (logical inline-end) half — ADR-249.
expect(toggleBox!.x + toggleBox!.width).toBeGreaterThan(passwordBox!.x + passwordBox!.width / 2);
```

A class-name assertion alone can miss a broken generated stylesheet; a browser geometry assertion catches the rendered result. Because the toggle also has an accessible `aria-label`, target the password input by role (`textbox`) rather than `getByLabel('Password')`, which can match both controls in Playwright strict mode.

Run the auth placement matrix from `apps/tests/viewport-matrix.ts`: small/medium/large mobile, tablet, laptop, desktop, large desktop, and landscape mobile. The control must remain inside the field, on its trailing/logical-end half, vertically centered, and keyboard/ARIA usable at every size.

## Visual Regression Testing

```typescript
// tests/visual/login.spec.ts
test('login page visual regression', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveScreenshot('login-page.png', {
    threshold: 0.2,
    maxDiffPixels: 100
  });
});
```

## Token Change Process

When modifying design tokens:

1. **Update Document**: Modify `plans/archive/008-design-tokens-v2.md`
2. **Update CSS**: Modify `globals.css` (`@theme` block + `:root` variables)
3. **Update Snapshots**: Run visual regression tests
4. **Migration Guide**: Document breaking changes
5. **Announce**: Notify team of token changes

## Touch-Target / Utility Generation Trap

Tailwind v4 generates CSS only for candidates found in scanned in-app sources.
`packages/ui` primitives may already carry `min-h-11` — but with zero
`apps/web` usages the rule never exists, so controls silently render at
intrinsic height (login inputs were 28px). The first in-app usage generates
the rule globally, which can grow tight layouts (login card +43px, tripping
the 1440×900 geometry guard in `apps/tests/login-responsive-controls.spec.ts`).

- Fix at the element level (spacing/padding rhythm); **never** remove the
  44px min-heights and never weaken the geometry guard.
- Before shipping: grep the served CSS (`dist/assets/*.css` or dev-served
  `globals.css`) for the utility class, not just the JSX literals.
- Verify layout-sensitive pages against a clean-base control build, not from
  memory of the design.

## Shared-Chunk Discipline (shell vs lazy routes)

Modules imported by both the shell (`App`/`AppShell`) and lazy routes must
not land in a route chunk: one static `index → reader-route` edge dragged all
of `reader-core` (~90KB gzip) into every route total (ADR-107 §3).

- Pin only genuinely shell-shared, small modules (`src/stores/`) to a neutral
  `app-shared` chunk in `vite.config.ts` `manualChunks`.
- Keep heavy shared logic (`lib/offline` barrel: IndexedDB + crypto + sync)
  behind a **dynamic import** in shell hooks; never pin `src/lib/offline`.
- Keep cross-chunk value references type-only (`'manual' as
  ConflictResolutionStrategy` instead of importing the enum) — the
  `reader-store.test.ts` strategy assertion guards the serialized value.
- Verify with `BUNDLE_BUDGET_FAIL_ON_VIOLATION=0 node
  scripts/check-bundle-budget.mjs` against a clean-base control build; don't
  eyeball chunk names.

## Missing Token Definitions

A utility can reference a CSS variable that is defined nowhere and silently
fall back (`.eyebrow` used `var(--font-mono)` with no `--font-mono` token —
every eyebrow label rendered in inherited serif/sans). When adding or
auditing utility classes, grep `var(--name)` usages against `--name:`
definitions in `globals.css`; add the missing token rather than a new font
import or one-off override.
