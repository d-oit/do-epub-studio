# Glassmorphism Guide

Implementation of glass-like UI effects using `color-mix()` with OKLCH tokens.

## CSS Classes (defined in `globals.css`)

### Glass Panel

```css
.glass-panel {
  background: color-mix(in oklch, var(--color-background) 80%, transparent);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid color-mix(in oklch, var(--color-foreground) 10%, transparent);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 color-mix(in oklch, var(--color-background) 20%, transparent);
}
```

### Glass Card

```css
.glass-card {
  background: color-mix(in oklch, var(--color-background) 70%, transparent);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid color-mix(in oklch, var(--color-foreground) 15%, transparent);
  border-radius: 1rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  transition: all 0.3s var(--ease-out-expo);
}

.glass-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
}
```

## Theme Adaptation

Both classes use `color-mix()` with semantic tokens, so they automatically adapt to light, dark, and sepia themes — no separate `.dark` overrides needed.

## When to Use

- **Glass Panel**: Headers, navigation overlays, floating UI (e.g. reader settings panel)
- **Glass Card**: Cards that need depth, modals, popovers
- **Avoid**: Primary content areas, large surfaces (performance)

## Accessibility Considerations

- Ensure sufficient contrast with underlying content
- Test with different backgrounds
- Consider performance on low-end devices
- `backdrop-filter` is not supported in all browsers — provide fallbacks where critical
