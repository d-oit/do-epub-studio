# Regression Prevention

Guidelines to prevent visual and functional regression.

## Design Token Lock

Design tokens are the single source of truth. **Never** deviate without updating the token documentation.

**Reference Documents:**
- `plans/008-design-tokens-v2.md` - Complete token specification
- `apps/web/tailwind.config.js` - Token implementation
- `apps/web/src/styles/globals.css` - CSS variable definitions

## Pre-Commit Checklist

- [ ] **No Hardcoded Values**: No hex colors, pixel values, or arbitrary sizes
- [ ] **Token Usage**: All colors use `bg-*`, `text-*`, `border-*` from tokens
- [ ] **Dark Mode**: All components render correctly in dark mode
- [ ] **Responsive**: Layouts work from 320px to 2560px
- [ ] **Motion**: Respects `prefers-reduced-motion`
- [ ] **Accessibility**: Touch targets min 44px, focus visible, ARIA labels

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

1. **Update Document**: Modify `plans/008-design-tokens-v2.md`
2. **Update Config**: Modify `tailwind.config.js`
3. **Update CSS**: Modify `globals.css` if needed
4. **Update Snapshots**: Run visual regression tests
5. **Migration Guide**: Document breaking changes
6. **Announce**: Notify team of token changes
