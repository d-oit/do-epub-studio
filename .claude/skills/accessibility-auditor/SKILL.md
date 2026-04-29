do-epub-studio/.agents/skills/accessibility-auditor/SKILL.md
```

---
version: "1.0.0"
name: accessibility-auditor
description: >
  Audit web applications for WCAG 2.2 compliance, screen reader compatibility,
  keyboard navigation, and color contrast. Activate for "accessibility audit",
  "a11y check", "WCAG compliance", "screen reader test", or "keyboard navigation".
category: quality
allowed-tools: Read Write Edit Glob Grep Bash
license: MIT
---

# Accessibility Auditor Skill

Audit web applications for WCAG 2.2 compliance, screen reader compatibility, keyboard navigation, and color contrast.

## When to Use

- Building new UI components
- Auditing existing interfaces
- Fixing accessibility issues
- Ensuring EPUB reader is accessible
- Compliance verification

## WCAG 2.2 Principles

### Perceivable

- **1.1.1** Non-text content has text alternative
- **1.3.1** Info and relationships programmatically determined
- **1.4.1** Use of color not only means of conveying info
- **1.4.3** Contrast minimum (4.5:1 for text)
- **1.4.4** Resize text up to 200%
- **1.4.10** Reflow (no horizontal scroll at 320px)
- **1.4.11** Non-text contrast (3:1)

### Operable

- **2.1.1** Keyboard accessible
- **2.1.2** No keyboard trap
- **2.4.1** Bypass blocks (skip links)
- **2.4.2** Page titled (descriptive)
- **2.4.3** Focus order logical
- **2.4.4** Link purpose from text
- **2.4.6** Headings and labels descriptive
- **2.4.7** Focus visible

### Understandable

- **3.1.1** Language of page
- **3.2.1** On focus no context change
- **3.2.2** On input no context change
- **3.3.1** Error identification
- **3.3.2** Labels or instructions

### Robust

- **4.1.1** Valid HTML
- **4.1.2** Name, role, value (ARIA)

## Audit Checklist

### Automated Checks

- [ ] No missing alt text on images
- [ ] Form inputs have labels
- [ ] Links have discernible text
- [ ] Color contrast meets 4.5:1 (3:1 for large text)
- [ ] HTML is valid
- [ ] ARIA used correctly

### Manual Checks

- [ ] Keyboard navigation works throughout
- [ ] Focus indicator visible
- [ ] Skip link present and functional
- [ ] Page titles descriptive
- [ ] Heading hierarchy logical
- [ ] Error messages clear and helpful

### Screen Reader Testing

- [ ] NVDA (Windows)
- [ ] VoiceOver (macOS/iOS)
- [ ] ChromeVox (Chrome)
- [ ] Content reads logically
- [ ] Images have appropriate alt text
- [ ] Form errors announced

## Testing Tools

### Browser DevTools

```bash
# Lighthouse accessibility audit
# Open DevTools → Lighthouse → Run accessibility audit

# Accessibility pane
# DevTools → Elements → Accessibility pane
```

### CLI Tools

```bash
# axe CLI
npx @axe-core/cli https://example.com

# pa11y
npx pa11y https://example.com

# WAVE
npx wave-web-api https://example.com
```

### VS Code Extensions

- ESLint JSX a11y plugins
- HTML CSS support
- Access Lens

## Common Issues & Fixes

### Missing Alt Text

```html
<!-- Bad -->
<img src="chart.png">

<!-- Good -->
<img src="chart.png" alt="Sales chart showing 40% growth in Q4">

<!-- Decorative -->
<img src="decoration.png" alt="">
```

### Missing Form Labels

```html
<!-- Bad -->
<input type="email" placeholder="Email">

<!-- Good -->
<label for="email">Email</label>
<input type="email" id="email" placeholder="Email">

<!-- Or -->
<label>
  Email
  <input type="email">
</label>
```

### Poor Color Contrast

```css
/* Bad - fails WCAG */
color: #999999;
background: #ffffff;

/* Good - passes WCAG AA */
color: #595959;
background: #ffffff;

/* For large text (18pt+ or 14pt bold) */
color: #767676;
background: #ffffff;
```

### Keyboard Traps

```javascript
// Bad - trap without way out
element.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault(); // Traps keyboard
  }
});

// Good - allow escape
element.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});
```

### Focus Order

```html
<!-- Bad - tab order confusing -->
<button>Save</button>
<input type="text">
<button>Cancel</button>

<!-- Good - logical order -->
<input type="text">
<button>Save</button>
<button>Cancel</button>
```

## EPUB Reader Specific

### Document Navigation

- [ ] Table of contents keyboard accessible
- [ ] Chapter navigation works with keyboard
- [ ] CFI navigation announced properly
- [ ] Reading progress accessible

### Reader Controls

- [ ] Font size adjustable
- [ ] Theme/scheme switchable
- [ ] All buttons keyboard accessible
- [ ] Focus visible on all interactive elements

### Annotations

- [ ] Highlights keyboard accessible
- [ ] Notes can be created via keyboard
- [ ] Annotation list navigable

### Screen Reader Considerations

- CFI locators should be readable
- Book title and author announced
- Chapter changes announced
- Page numbers accessible

## Color Contrast Reference

| Text Size | AA (Normal) | AA (Large) | AAA (Normal) | AAA (Large) |
|-----------|-------------|------------|--------------|-------------|
| Normal    | 4.5:1       | 3:1        | 7:1          | 4.5:1       |
| Large     | 3:1         | 3:1        | 4.5:1        | 3:1         |

*Large text: 18pt+ regular or 14pt+ bold*

## Focus Indicators

```css
/* Good focus indicators */
:focus {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

/* Better - visible on all backgrounds */
:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
```

## ARIA Quick Reference

| Pattern | ARIA | Usage |
|---------|------|-------|
| Button (not native) | role="button" | Custom clickable elements |
| Modal | role="dialog", aria-modal="true" | Dialogs |
| Navigation | role="navigation" | Nav regions |
| Main content | role="main" | Primary content |
| Complementary | role="complementary" | Sidebar content |
| Live region | aria-live="polite" | Dynamic updates |
| Expandable | aria-expanded | Collapsible sections |
| Required | aria-required="true" | Required fields |

## Integration

- **code-review-assistant**: Use in PR reviews
- **reader-ui-ux**: Apply to EPUB reader
- **dogfood**: Test with assistive tech

## Quality Checklist

- [ ] Automated tests pass (axe/pa11y)
- [ ] Manual keyboard testing complete
- [ ] Screen reader testing complete
- [ ] Color contrast verified
- [ ] No accessibility violations
- [ ] Focus indicators visible

## Summary

Accessibility is essential for inclusive design. Audit early, test with real assistive technology, and fix issues proactively. WCAG 2.2 provides clear success criteria to follow.