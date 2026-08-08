# GOAP Plan 082 — Modern UI Design Overhaul + Missing Features

**Date:** 2026-06-11
**Goal:** Elevate UI to 2026 Editorial Minimalist standard; close feature gaps
**Strategy:** Phased — Design System Foundation → Pages → Features
**Art Direction:** EPUB reading studio — calm, focused, typographic, warm neutrals

---

## Analyze: Current vs Target

### Design Direction (2026 Editorial Minimalist)

| Principle | Current State | Target |
|-----------|--------------|--------|
| Typography hierarchy | Single font (Inter), fixed sizes | 3 fonts, fluid clamp() scale |
| Surfaces | Glass-panel (backdrop-blur heavy) | Warm monochrome, flat cards, precise 1px borders |
| Spacing | Ad-hoc (--header-height only) | Full T-shirt scale (--space-1 to --space-24) |
| Color | OKLCH ✅ but generic blue primary | Warm teal primary, warm neutrals, restrained accent |
| Motion | Framer Motion (good) | Keep, add spring physics for interactions |
| Layout | No responsive shell | Grid + dvh + container queries |
| Shadows | Inline rgba() values | Tokenized elevation layers (--shadow-sm/md/lg) |
| Content | Generic copy, empty states | Product-specific, contextual empty states |

### Anti-Patterns to Remove

- `glass-panel` / `glass-card` overuse (2024 glassmorphism — dated)
- `backdrop-blur` as primary surface treatment (performance cost, dated)
- Purple/violet `--color-accent-secondary: oklch(54.1% 0.247 293.0)` (AI-slop indicator)
- Centered-everything layout on NotFoundPage
- Generic loading animations (bouncing dots)
- `bg-gray-50 dark:bg-gray-900` hardcoded classes

---

## Phase 1: Design Token Completion

### 1.1 Typography Tokens

```css
/* Fluid scale (Utopia-based, 320px→1280px) */
--text-xs:   clamp(0.75rem,  0.71rem + 0.18vi, 0.875rem);
--text-sm:   clamp(0.875rem, 0.83rem + 0.22vi, 1rem);
--text-base: clamp(1rem,     0.95rem + 0.25vi, 1.125rem);
--text-lg:   clamp(1.125rem, 1.05rem + 0.38vi, 1.375rem);
--text-xl:   clamp(1.5rem,   1.32rem + 0.89vi, 2rem);
--text-2xl:  clamp(2rem,     1.64rem + 1.79vi, 3rem);

/* Font stacks — distinctive, branded */
--font-display: 'Cabinet Grotesk', sans-serif;
--font-body:    'Satoshi', 'Inter', sans-serif;
--font-reader:  'Source Serif 4', Georgia, serif;
--font-mono:    'JetBrains Mono', monospace;
```

### 1.2 Spacing Scale

```css
--space-0: 0;        --space-px: 1px;
--space-1: 0.25rem;  --space-2: 0.5rem;
--space-3: 0.75rem;  --space-4: 1rem;
--space-5: 1.25rem;  --space-6: 1.5rem;
--space-8: 2rem;     --space-10: 2.5rem;
--space-12: 3rem;    --space-16: 4rem;
--space-20: 5rem;    --space-24: 6rem;
```

### 1.3 Elevation System

```css
--shadow-xs: 0 1px 2px oklch(0 0 0 / 0.04);
--shadow-sm: 0 2px 4px oklch(0 0 0 / 0.06);
--shadow-md: 0 4px 12px oklch(0 0 0 / 0.08);
--shadow-lg: 0 8px 24px oklch(0 0 0 / 0.10);
--shadow-xl: 0 16px 48px oklch(0 0 0 / 0.12);
```

### 1.4 Color Correction

- Replace purple accent `oklch(54.1% 0.247 293.0)` with warm teal
- Shift primary hue from cold blue (250-265°) to warm teal (180-200°)
- Warm up neutrals (add subtle warm hue to grays)

### Files:
- `apps/web/src/styles/globals.css` — token additions
- `packages/ui/src/styles/tokens.css` — new canonical source
- `packages/ui/src/styles/base.css` — reset + base
- `apps/web/index.html` — font preconnect

---

## Phase 2: Surface & Component Upgrade

### 2.1 Replace Glassmorphism with Editorial Surfaces

| Before (glassmorphism) | After (editorial minimalist) |
|--------|-------|
| `backdrop-blur(24px)` | `background: var(--color-surface)` |
| `color-mix transparency` | Solid surface tokens |
| Frosted glass borders | 1px `var(--color-border)` |
| `shadow-glass-lg` | `var(--shadow-md)` |

**Keep** glass-panel for ONE element only: the reader toolbar (functional use).

### 2.2 Card Component Upgrade

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-xs);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px); /* subtle, not -4px */
}
```

### 2.3 NotFoundPage — Token-Aware Rebuild

- Remove all `gray-*` / `dark:*` hardcoded classes
- Use `bg-background`, `text-foreground`, `text-foreground-muted`
- Add i18n for all strings
- Use editorial layout (left-aligned, not centered everything)

### 2.4 ErrorBoundary — Token + i18n

- Replace hardcoded English with t() keys
- Replace `glass-panel` with solid surface card
- Use `--shadow-md` not `shadow-glass-lg`

### 2.5 CatalogPage — Enhanced Skeletons

- Add image placeholder skeletons with aspect ratio
- Add content-shimmer for title/author lines
- Remove `glass-card` in favor of editorial card

### Files:
- All page components
- `packages/ui/src/card.tsx`
- `.agents/skills/anti-ai-slop/SKILL.md`

---

## Phase 3: Missing Features (Priority Order)

### 3.1 Library/Bookshelf Page (HIGH)

**Route:** `/library`
**Purpose:** Post-login landing — shows user's books, progress, recent activity.

```
┌─────────────────────────────────────┐
│ Your Library            [Search]    │
├─────────────────────────────────────┤
│ Continue Reading                    │
│ ┌──────┐ ┌──────┐ ┌──────┐       │
│ │Cover │ │Cover │ │Cover │        │
│ │ 45%  │ │ 12%  │ │ 78%  │        │
│ └──────┘ └──────┘ └──────┘        │
│                                     │
│ All Books (3)                       │
│ ┌──────────────────────────────┐   │
│ │ Book Title — Author   [Read] │   │
│ │ Last read: 2 days ago        │   │
│ └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Components:** BookCard, ProgressBar, EmptyLibrary

### 3.2 Search UI (HIGH)

**Pattern:** Command palette (⌘K / Ctrl+K)
- Search books by title/author
- Search annotations/bookmarks
- Quick navigation commands

### 3.3 Global Toast Integration (HIGH)

- Wire `packages/ui/src/toast.tsx` into app root
- Create Zustand toast store
- Auto-dismiss, stacking, accessible

### 3.4 Offline Download UI (MEDIUM)

- "Download for offline" button on book cards
- Download progress indicator
- Offline indicator badge on downloaded books
- Infrastructure exists in `lib/offline/` — needs UI trigger

### 3.5 Keyboard Shortcuts Help (MEDIUM)

- `?` key opens shortcuts overlay
- Lists reader shortcuts, navigation shortcuts
- Dismissable with Escape

### 3.6 Empty States (MEDIUM)

- Library: no books → CTA to browse catalog
- Bookmarks: no bookmarks → explanation of how to add
- Annotations: no annotations → guidance
- Search: no results → suggestion

### 3.7 User Profile/Settings Page (LOW)

- Account info (email, locale preference)
- Theme preference (global, not just reader)
- Reading statistics (books read, time spent)

---

## Phase 4: Container Queries + Responsive Refinement

### 4.1 Add Container Query Declarations

```css
.book-grid { container: book-grid / inline-size; }
.reader-panel { container: panel / inline-size; }
.card-wrapper { container: card / inline-size; }

@container book-grid (width < 480px) {
  .book-card { grid-template-columns: 1fr; }
}
@container panel (width < 320px) {
  .panel-content { font-size: var(--text-sm); }
}
```

### 4.2 Remove `glass-card:hover transform: translateY(-4px)`

Replace with subtle `translateY(-2px)` + shadow elevation change.
-4px is excessive for 2026 editorial aesthetic.

### 4.3 Add `forced-colors` Fallbacks

```css
@media (forced-colors: active) {
  .card { border: 2px solid ButtonText; }
  .btn-primary { border: 2px solid ButtonText; }
  :focus-visible { outline: 3px solid Highlight; }
}
```

---

## Phase 5: Skill File Updates

### `.agents/skills/design-tokens/SKILL.md` (new)

- OKLCH-only color rule
- Fluid type scale reference
- Spacing scale reference
- Font usage matrix (display ≥24px, body for UI, reader for content)
- Shadow elevation usage guide

### `.agents/skills/anti-ai-slop/SKILL.md` (update)

Add to blacklist:
- Glassmorphism as primary surface (keep for ONE functional use only)
- Purple/violet accents
- translateY(-4px) hover transforms
- Bouncing dot loading indicators
- Generic "Unlock the power of..." copy

Add to approved list:
- Editorial flat cards with 1px borders
- Warm monochrome surfaces
- Subtle shadow elevation (translateY(-2px) max)
- Content-specific empty states
- Product-accurate copy

---

## Execution Order

```
Phase 1 ── Token completion (foundation)
  ↓
Phase 2 ── Surface/component upgrade (parallel tasks)
  ↓
Phase 3 ── Missing features (prioritized backlog)
  ↓
Phase 4 ── Responsive refinement
  ↓
Phase 5 ── Skill documentation
```

---

## Success Metrics

- [ ] Zero hardcoded `gray-*` or `dark:*` utility classes in pages
- [ ] All font sizes use `var(--text-*)` fluid tokens
- [ ] All spacing uses `var(--space-*)` tokens
- [ ] All shadows use `var(--shadow-*)` tokens
- [ ] No `backdrop-blur` except reader toolbar
- [ ] No purple/violet accent colors
- [ ] Library page renders with progress cards
- [ ] Search (⌘K) opens and queries books
- [ ] Toast system wired and functional
- [ ] Empty states for all zero-data screens
- [ ] Container queries on book grid + reader panels
- [ ] `forced-colors` media query support present
- [ ] All pages pass axe-core audit at WCAG 2.2 AA

---

## Agent Skill References

- `.agents/skills/anti-ai-slop/` — pattern blacklist enforcement
- `.agents/skills/design-tokens/` — token system rules
- `.agents/skills/reader-ui-ux/` — reader-specific UX
- `.agents/skills/accessibility-auditor/` — WCAG compliance
