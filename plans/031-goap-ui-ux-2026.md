# Plan 031: GOAP — Comprehensive UI/UX Improvements for 2026

**Date:** 2026-05-16
**Goal:** Implement 2026 modern UI/UX standards as identified in the audit: OKLCH color system, panel mutual exclusivity, scroll-aware toolbar, app shell, and view transitions.
**Status:** 🏗️ **IN PROGRESS**
**Strategy:** Systematic rollout via feature-sliced refactoring and design token migration.

---

## Task Decomposition

### Phase 1: Foundation & Architecture (High Priority)
1. **OKLCH Migration**: Convert hex/RGB colors to `oklch()` in `globals.css` with P3 gamut support.
2. **Tailwind v4 @layer**: Restructure `globals.css` using `@layer components` and `@layer utilities`.
3. **View Transitions**: Enable React Router v7 View Transitions in `main.tsx` and `App.tsx`.

### Phase 2: Reader Core UX (High Priority)
4. **Panel Manager**: Implement mutual exclusivity for Reader panels (TOC, Settings, Bookmarks, Comments) via unified state.
5. **Scroll-Aware Toolbar**: Wire `ReaderToolbar` to hide/show based on scroll direction and add reading progress.
6. **Annotation Micro-interactions**: Add scale animations and tooltips to `AnnotationToolbar`.

### Phase 3: App Shell & Reliability (Medium Priority)
7. **App Shell**: Create `AppShell` with animated splash/skeleton to resolve auth state at `/`.
8. **ErrorBoundary Redesign**: Modernize error UI with contextual recovery and retry logic.

---

## Dependency Map

```
Phase 1 (Foundation) ──────┐
                           ↓
Phase 2 (Reader UX) ───────┤
                           ↓
Phase 3 (App Shell) ───────┘
```

## Quality Gates

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Visual verification of OKLCH colors on P3-capable simulator (if possible) or hex fallback
- [ ] Verify no panel overlap in Reader

## ADR References
- **ADR-032**: UI/UX Standards for 2026 Modern Web
