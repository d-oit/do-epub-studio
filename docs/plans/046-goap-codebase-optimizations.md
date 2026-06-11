# GOAP Plan 046: Codebase Performance and Caching Optimizations

**Date**: 2026-05-22 (updated 2026-05-26)
**Status**: ✅ Closed — All 8 tasks confirmed implemented via code inspection on 2026-05-26
**Goal**: Address 7 codebase optimization issues across routing, bundling, service worker caching, state, and CI/CD fast checks to improve performance, security, and developer experience.

## Dependency Map

```
[Store & Config Foundations] (turbo.json, package.json, reader.ts)
                    ↓
[App Routing & SW Optimizations] (App.tsx, main.tsx, sw.ts, vite.config.ts)
```

## Analysis

### 1. Route Lazy Loading (`App.tsx`)
- **Issue**: Route components (`ReaderPage`, `AdminBookResponsesPage`, etc.) are imported statically, inflating the initial JS bundle.
- **Action**: Replace with `React.lazy` + `Suspense` with a premium, smooth glassmorphism fallback spinner.

### 2. Vite Config & Sourcemap Gating (`vite.config.ts`)
- **Issue**: `framer-motion` is not chunk-split; `sourcemap: true` in production exposes source code; no root command for visual analyzer.
- **Action**: Update `manualChunks` to split `framer-motion`; environment-gate `sourcemap: process.env.NODE_ENV !== 'production'`; add `"build:analyze"` to root `package.json`.

### 3. Service Worker Issues (`sw.ts`)
- **Issues**:
  - `book-content` cache uses `CacheFirst` which risks stale/deleted books; should be `StaleWhileRevalidate` with a 7-day TTL.
  - Route overlap risk for catch-all API `NetworkFirst` pattern matching.
  - No storage quota guard or `CacheableResponsePlugin` for `images` cache.
  - Production SW logs raw JSON via `console.log`.
- **Action**: Refactor `sw.ts` with `StaleWhileRevalidate`, explicit negative-lookahead regex matching, a standard Workbox `quotaGuardPlugin`, and `DEBUG` flag for logging.

### 4. Double SW Registration (`main.tsx`)
- **Issue**: Manual SW registration conflicts with `vite-plugin-pwa`'s injected update lifecycle.
- **Action**: Remove manual registration block, rely on `vite-plugin-pwa` client registration `registerSW` to handle background sync registration.

### 5. Reader Store SSR Safety & Comments Optimization (`stores/reader.ts`)
- **Issues**:
  - `navigator.onLine` checked at module level, risking SSR/testing errors.
  - Recursive `addComment` reply traversal has O(n×d) complexity.
- **Action**: Gate `navigator.onLine` behind `typeof navigator !== 'undefined'`; implement O(n) map-based comment insert and update logic.

### 6. Missing Cache Inputs (`turbo.json`)
- **Issue**: `lint` and `typecheck` tasks do not specify inputs, causing false cache misses in Turborepo.
- **Action**: Define explicit file inputs for `lint` and `typecheck` in `turbo.json`.

### 7. Fragile `verify:fast` Script (`package.json`)
- **Issue**: Root script `verify:fast` hardcodes specific directories, missing new features.
- **Action**: Replace with Vitest `--changed main` parameter to automatically target only modified test files.

---

## Tasks

| ID | Task | Priority | Status | Files Affected |
|----|------|----------|--------|----------------|
| 1 | Update `turbo.json` with explicit lint/typecheck inputs | P0 | ✅ Completed | `turbo.json` |
| 2 | Optimize `verify:fast` and add `build:analyze` to root | P0 | ✅ Completed | `package.json` |
| 3 | SSR gate & O(n) comment tree map-update | P0 | ✅ Completed | `apps/web/src/stores/reader.ts` |
| 4 | Use `registerSW` for clean background sync & registration | P0 | ✅ Completed | `apps/web/src/main.tsx` |
| 5 | Refactor Service Worker caching, quota guard, non-overlapping routes | P0 | ✅ Completed | `apps/web/src/sw.ts` |
| 6 | Manual chunk splitting & sourcemap env-gating | P0 | ✅ Completed | `apps/web/vite.config.ts` |
| 7 | Route lazy loading with Suspense | P0 | ✅ Completed | `apps/web/src/App.tsx` |
| 8 | Update unit tests for sw.ts changes | P0 | ✅ Completed | `apps/web/src/__tests__/sw-config.test.ts` |

## Strategy

**Sequential Execution**:
- We will execute each task sequentially on a clean feature branch (`feat/codebase-optimizations`), validating each step using our fast checks.
- When done, we will run the full Quality Gate before creating a PR.

## Quality Gates
- Every step: `pnpm typecheck` + `pnpm lint`.
- Final check: `./scripts/quality_gate.sh` passing with 100% success.

---

## ADR-046: Codebase Performance and Caching Optimizations

### Context
A file-level audit identified several high-impact optimization opportunities across bundling, PWA strategies, state mutation, Turborepo caching, and test execution paths. Unsplit large dependencies like `framer-motion` and un-gated source maps slowed production loads and exposed source code. Broad `CacheFirst` caching on dynamic book files risked showing deleted or stale books, while double service-worker registrations and O(n×d) comments recursion risked performance bottlenecks and race conditions.

### Decision
Standardize codebase optimizations:
1. Wrap routes in `React.lazy` + `Suspense`.
2. Segment `framer-motion` to a separate chunk and disable prod sourcemaps.
3. Replace manual service-worker registration with `vite-plugin-pwa` canonical `registerSW`.
4. Transition `book-content` to `StaleWhileRevalidate` with 7-day TTL, integrate a custom `quotaGuardPlugin` for storage control, use negative-lookahead regexes for non-overlapping SW routes, and gate production `console.log` statements.
5. Gate reader store module initialization and optimize comments mutation with O(n) flat-map reference-based processing.
6. Configure explicit inputs in `turbo.json` and use `--changed main` in `verify:fast`.

### Consequences
- **Positive**: Decreases initial JS bundle sizes significantly.
- **Positive**: Ensures service worker acts predictably with zero double-registrations, non-overlapping routes, and active storage quota guards.
- **Positive**: Protects state updates from O(n×d) comment tree traversal bottlenecks.
- **Positive**: Accelerates Turborepo caching and fast-test targeting.
- **Negative**: Adds minor lazy loading delay for route navigations (mitigated by premium Glassmorphic spinner fallback).
