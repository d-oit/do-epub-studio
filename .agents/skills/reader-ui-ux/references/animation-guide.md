# Animation Guide

CSS-only animation patterns for 2026 UI standards. All keyframes are defined in `globals.css` — no JavaScript animation library required for standard patterns.

## Available Keyframes & Utility Classes

All animations use `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)` and respect `prefers-reduced-motion`.

| Keyframe | Utility Class | Duration | Use Case |
|----------|--------------|----------|----------|
| `fadeIn` | `.animate-fade-in` | 0.2s | General enter |
| `fadeOut` | `.animate-fade-out` | 0.2s | General exit |
| `scaleIn` | `.animate-scale-in` | 0.2s | Modals, popovers |
| `scaleOut` | `.animate-scale-out` | 0.2s | Modal dismiss |
| `slideInFromBottom` | `.animate-slide-in-bottom` | 0.2s | Toast, SW update |
| `slideOutToBottom` | `.animate-slide-out-bottom` | 0.2s | Toast dismiss |
| `slideInFromRight` | `.animate-slide-in-right` | 0.3s | Side panel open |
| `slideOutToRight` | `.animate-slide-out-right` | 0.3s | Side panel close |
| `slideUpFadeIn` | `.animate-slide-up-fade` | 0.2s | Staggered list items |
| `slideDownFadeIn` | `.animate-slide-down-fade` | 0.2s | Dropdown menus |

## Page Transitions (View Transitions API)

```css
/* globals.css already defines: */
::view-transition-old(root) { animation: 0.25s ease-out both exit-fade; }
::view-transition-new(root) { animation: 0.25s ease-out both enter-fade; }
```

```tsx
// React Router v7 — just add viewTransition to navigate options
navigate('/catalog', { viewTransition: true });
```

## Micro-interactions (CSS)

### Button Tap/Hover

```tsx
// Tailwind classes — no motion library needed
<button className="hover:scale-[1.02] active:scale-[0.98] transition-transform duration-150">
  Click me
</button>
```

### Card Hover

```tsx
<div className="glass-card transition-transform duration-200 hover:-translate-y-1">
  Content
</div>
```

## Staggered Lists (CSS)

```tsx
// Use animation-delay for stagger effect
{items.map((item, i) => (
  <div
    key={item.id}
    className="animate-slide-up-fade"
    style={{ animationDelay: `${i * 50}ms` }}
  >
    {item.content}
  </div>
))}
```

## Modal Animations (CSS)

```tsx
// Backdrop
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

// Modal content
<div className="glass-panel animate-scale-in">
  Content
</div>
```

For exit animations, use the `isExiting` state pattern with the corresponding exit class:

```tsx
<div className={`animate-${isExiting ? 'fade-out' : 'fade-in'}`}>
  Content
</div>
```

## Reduced Motion Support

All animations are automatically suppressed via the consolidated `@media (prefers-reduced-motion: reduce)` block in `globals.css`, which sets `animation-duration: 0.01ms !important` and resets all `--motion-*` variables. No JavaScript check needed.

## Common Patterns

### Fade In Up

```tsx
<div className="animate-slide-up-fade">Content</div>
```

### Scale In

```tsx
<div className="animate-scale-in">Content</div>
```

### Slide In From Left

```tsx
<div className="animate-slide-in-left">Content</div>
```
