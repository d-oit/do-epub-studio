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

## Testing Tools

### CLI Tools

```bash
# axe CLI
npx @axe-core/cli https://example.com

# pa11y
npx pa11y https://example.com
```

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
```

### Poor Color Contrast

```css
/* Bad - fails WCAG */
color: #999999;
background: #ffffff;

/* Good - passes WCAG AA */
color: #595959;
background: #ffffff;
```

## Focus Indicators

```css
/* Good focus indicators */
:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
```

## ARIA Quick Reference

| Pattern | ARIA | Usage |
|---------|------|-------|
| Button | role="button" | Custom clickable elements |
| Modal | role="dialog" | Dialogs |
| Navigation | role="navigation" | Nav regions |
| Main content | role="main" | Primary content |
| Live region | aria-live="polite" | Dynamic updates |
| Expandable | aria-expanded | Collapsible sections |

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

### Screen Reader Considerations

- CFI locators should be readable
- Book title and author announced
- Chapter changes announced
- Page numbers accessible

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

Accessibility is essential for inclusive design. Audit early, test with real assistive technology, and fix issues proactively.
