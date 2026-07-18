# GOAP 105 — UI Modernization: 2026 Web Platform APIs & React 19 Patterns

**Date:** 2026-06-23
**Status:** ✅ COMPLETED (verified 2026-07-18 — all actionable items implemented)
**Execution tracker:** consolidated & re-verified in `plans/110-goap-missing-impl-modern-ui-2026-06-24.md`; **final verification in `plans/197`**
**Author:** Codebase analysis session
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Related ADR:** `plans/105-adr-2026-ui-platform-modernization.md`
**Extends:** ADR-079 (2026 Web Platform Standards), ADR-082b (Editorial Minimalist UI)

## Goal

Adopt 2026 web platform APIs and React 19 patterns that are missing from
the frontend, improving performance, accessibility, and developer
experience while maintaining the editorial minimalist design direction.

## Analysis — Current State

### Already Implemented (solid foundation)

- OKLCH design tokens with P3 wide-gamut overrides
- Dark / sepia / light themes with semantic variables
- Fluid typography via `clamp()`
- `prefers-reduced-motion` with motion variable resets
- View Transitions API (`ViewTransitionRoutes.tsx`)
- Glassmorphism components (`glass-panel`, `glass-card`)
- Tailwind 4 with `@theme` layer
- Zustand stores (auth, reader, preferences, locale)
- Service Worker with offline sync and conflict resolution
- `color-mix()` usage for transparency

### Missing — 2026 Platform APIs (zero usage found)

| Feature | Benefit | Effort |
|---------|---------|--------|
| **Container Queries** (`@container`) | Component-intrinsic responsiveness for reader panels, cards, admin tables | M |
| **Scroll-Driven Animations** (`animation-timeline: scroll()`) | Reading progress bar, parallax headers, chapter-enter animations | S |
| **Popover API** (`popover` attribute) | Native tooltips, annotation menus, settings dropdowns — no JS needed | S |
| **Anchor Positioning** (`anchor-name`, `position-anchor`) | Annotation toolbar anchored to text selection | M |
| **CSS Subgrid** | Admin tables, catalog grid, TOC hierarchy | S |
| **Logical Properties** (`padding-inline`, `margin-block`) | RTL/i18n readiness | S |

### Missing — React 19 Patterns

| Pattern | Current Approach | Benefit |
|---------|-----------------|---------|
| `use()` hook for data fetching | `useEffect` + `useState` | Suspense-native, eliminates loading state boilerplate |
| `useOptimistic` | Manual optimistic state in reader store | Native optimistic UI for annotations/bookmarks |
| `useFormStatus` | Custom `isSubmitting` state | Built-in form pending states for admin pages |
| `useActionState` | Manual form handling | Declarative form actions for login, grants |

### Missing — Modern UI Patterns

| Pattern | Where needed | Status |
|---------|-------------|--------|
| Skeleton loading with content-visibility | CatalogPage, BooksPage | Has skeleton class, not using `content-visibility` |
| Scroll-snap for reader pagination | ReaderPage horizontal swipe | Not implemented |
| `view-transition-name` per-element | Book cards → reader transition | Only root transition |
| `interpolate-size: allow-keywords` | Collapsible panels (TOC, settings) | Not using |
| `field-sizing: content` | Comment/annotation text inputs | Not using |

## Decomposed Tasks

### Phase 1 — Low-effort, high-impact (1 session)

1. **Add logical properties** — Replace `padding-left/right` with `padding-inline-start/end`, `margin-top/bottom` with `margin-block` across globals.css and components
2. **Add `popover` to tooltips and menus** — Refactor Tooltip, AnnotationToolbar, ReaderSettingsPanel to use native popover
3. **Add scroll-driven progress bar** — Reader progress indicator using `animation-timeline: scroll()`

### Phase 2 — Container queries and subgrid (1-2 sessions)

4. **Container queries for reader panels** — TOC, SearchPanel, BookmarksPanel, CommentsPanel become container-responsive
5. **Container queries for catalog/admin** — CatalogPage card grid, BooksPage admin table
6. **Subgrid for structured layouts** — Admin data tables, TOC nested items

### Phase 3 — React 19 patterns (2 sessions)

7. **Migrate data fetching to `use()`** — CatalogPage, BooksPage, AuditLogPage, GrantsPage
8. **Add `useOptimistic`** — Annotation create, bookmark toggle, comment post
9. **Add `useFormStatus`** — LoginPage, AdminLoginPage, GrantsPage forms
10. **Add `useActionState`** — Replace manual form submission handlers

### Phase 4 — Advanced animations (1 session)

11. **Per-element view transitions** — `view-transition-name` on book cards for morph-to-reader
12. **Anchor positioning** — AnnotationToolbar positioned relative to text selection
13. **Scroll-snap** — Horizontal page navigation in reader

## Risks

- Container queries require Tailwind 4 `@container` variant configuration
- Popover API polyfill not needed (baseline 2024), but test across Playwright browsers
- React 19 `use()` requires Suspense boundaries around consuming components
- Anchor positioning is Baseline 2025; verify Playwright chromium version supports it

## Success Criteria

- [ ] Zero `padding-left/right` or `margin-top/bottom` in source (all logical)
- [ ] At least 3 components using `@container`
- [ ] Reading progress uses scroll-driven animation
- [ ] Annotation toolbar uses native `popover`
- [ ] At least one page migrated to `use()` with Suspense
- [ ] All changes pass `prefers-reduced-motion` — no motion regressions
- [ ] Lighthouse Performance score maintained ≥ 90
