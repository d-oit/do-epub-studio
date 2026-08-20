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
- [ ] **Password toggle placement**: Show/hide controls are anchored to the documented leading/left edge, with matching input padding and RTL-safe logical positioning

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
const password = page.getByLabel('Password');
const toggle = page.getByRole('button', { name: 'Show password' });
const passwordBox = await password.boundingBox();
const toggleBox = await toggle.boundingBox();
expect(passwordBox).not.toBeNull();
expect(toggleBox).not.toBeNull();
expect(toggleBox!.x).toBeLessThan(passwordBox!.x + passwordBox!.width / 2);
```

A class-name assertion alone can miss a broken generated stylesheet; a browser geometry assertion catches the rendered result. Because the toggle also has an accessible `aria-label`, target the password input by role (`textbox`) rather than `getByLabel('Password')`, which can match both controls in Playwright strict mode.

Run the auth placement matrix from `apps/tests/viewport-matrix.ts`: small/medium/large mobile, tablet, laptop, desktop, large desktop, and landscape mobile. The control must remain inside the field, on its leading/left half, vertically centered, and keyboard/ARIA usable at every size.

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
