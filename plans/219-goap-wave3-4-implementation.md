# GOAP 219: Implement GOAP-218 Wave 3-4

**Date:** 2026-08-07
**Status:** In Progress
**Goal:** Implement Wave 3 (Runtime Optimization) and Wave 4 (CI/Budget Hardening) from GOAP-218.
**Related:** GOAP-218, ADR-218, ADR-107

## 1. Analysis

### Current State (verified on `main` after PR #924 merge)

Wave 1-2 have been successfully implemented:
- PerformanceObserver marks for 6 reader pipeline stages ✓
- Worker pipeline (`parseEpubInWorker`) wired into `useReaderEpub.ts` ✓
- Sanitization LRU cache (10 entries) ✓
- Incremental sanitization window with `requestIdleCallback` ✓
- Bundle baseline artifact with Brotli reporting ✓
- CI regression gate blocking ✓
- EPUB test corpus (5 books) ✓

### Remaining Gaps (Wave 3-4)

| Task | ID | Description | Key Files |
|------|----|-------------|-----------|
| Virtualize annotation rendering | T3.1 | Batch `renderHighlights`/`renderCommentMarkers` in rAF, suspend offscreen painting, debounce `relocated` handler | `useReaderEpub.ts`, `annotation-adapter.ts` |
| Selective prefetch | T3.2 | Prefetch next spine item at low priority after 500ms idle, network/storage-aware | `sw.ts`, `useReaderEpub.ts`, new `prefetch-manager.ts` |
| Virtualize search results | T3.3 | Viewport-windowed results, lazy-highlight visible results only | `useReaderSearch.ts` |
| Bundle boundary enforcement | T3.4 | CI assertion: catalog/auth shell never imports reader-core through shared barrels | `vite.config.ts`, `check-bundle-size.mjs` |
| Unified budget model | T4.1 | Remove raw-byte `bundleSize`, single gzipped model, align with ADR-107 §3 | `.performance-budgets.json`, `check-bundle-budget.mjs` |
| Split CI fast/full checks | T4.2 | PR checks: changed-package fast; merge-queue: full coverage + Lighthouse | `ci.yml`, `turbo.json` |
| Trend tracking | T4.3 | Upload and trend task durations, cache-hit ratio, bundle deltas, flaky rates | `ci.yml`, `report-performance.mjs` |
| Lighthouse reader route | T4.4 | Auth fixture for reader route, reader-specific mobile assertions | `.lighthouserc.json`, `lighthouse.yml` |

## 2. Decomposition — Hybrid Swarm

### Wave 3 (parallel, independent file sets)

| Task | ID | Agent scope | Key files |
|------|----|-------------|-----------|
| T3.1 | Annotation virtualization | Batch rendering in rAF, suspend offscreen, debounce relocated | `apps/web/src/features/reader/hooks/useReaderEpub.ts`, `packages/reader-core/src/annotation-adapter.ts` |
| T3.2 | Selective prefetch | Network/storage-aware prefetch next spine item | `apps/web/src/sw.ts`, `apps/web/src/features/reader/hooks/useReaderEpub.ts`, new `apps/web/src/lib/prefetch-manager.ts` |
| T3.3 | Search virtualization | Viewport-windowed results, lazy highlight | `apps/web/src/features/reader/hooks/useReaderSearch.ts` |
| T3.4 | Bundle boundary enforcement | CI assertion for lazy-loaded boundaries | `apps/web/vite.config.ts`, `scripts/check-bundle-size.mjs` |

### Wave 4 (parallel, after Wave 3)

| Task | ID | Agent scope | Key files |
|------|----|-------------|-----------|
| T4.1 | Unified budget model | Single gzipped model, align with ADR-107 | `.performance-budgets.json`, `scripts/check-bundle-budget.mjs` |
| T4.2 | Split CI fast/full | PR fast checks, merge-queue full | `.github/workflows/ci.yml`, `turbo.json` |
| T4.3 | Trend tracking | Performance trend reporting | `.github/workflows/ci.yml`, `scripts/report-performance.mjs` |
| T4.4 | Lighthouse reader route | Auth fixture, reader assertions | `.lighthouserc.json`, `.github/workflows/lighthouse.yml` |

## 3. Execution Strategy

**Hybrid swarm** per ADR-212 and GOAP-218:

- **Wave 3:** fully parallel — 4 agents on disjoint file sets
- **Wave 4:** fully parallel — 4 agents on disjoint file sets

Quality gates between waves:
1. After Wave 3: `./scripts/quality_gate.sh` + `pnpm bench` (no regression)
2. After Wave 4: full CI green on PR (`gh pr checks`)

## 4. Acceptance Criteria

- [ ] Annotation rendering batched in rAF; no layout thrash on chapter nav
- [ ] Selective prefetch respects network/storage constraints
- [ ] Search results viewport-windowed; lazy-highlight only visible
- [ ] Bundle boundary enforcement catches violations in CI
- [ ] Single authoritative gzipped budget model; stale raw-byte model removed
- [ ] CI split: fast PR checks + full merge-queue checks
- [ ] Trend tracking uploads performance data across runs
- [ ] Lighthouse reader route with auth fixture and reader assertions
- [ ] All existing tests pass; reader-core coverage ≥72% lines / 70% functions
- [ ] No new `any` types; no new files >500 LOC

## 5. Risk Register

| Risk | Mitigation |
|------|------------|
| Annotation batching breaks highlight timing | Event-bridge tests comparing batched vs immediate behavior |
| Prefetch wastes bandwidth on slow networks | Network-aware (`effectiveType`, save-data) + storage-quota-aware |
| Search virtualization causes flicker | Maintain scroll position; use `IntersectionObserver` for visibility |
| Bundle boundary assertion false positives | Test against known good imports; allow explicit barrel re-exports |
| CI split causes missed regressions | Merge-queue gates require full checks before merge |
| Trend tracking adds CI overhead | Async upload; don't block pipeline |

## 6. Critical Files

| File | Role |
|------|------|
| `apps/web/src/features/reader/hooks/useReaderEpub.ts` | Annotation batching, prefetch trigger |
| `packages/reader-core/src/annotation-adapter.ts` | Highlight/comment rendering |
| `apps/web/src/features/reader/hooks/useReaderSearch.ts` | Search result virtualization |
| `apps/web/src/sw.ts` | Service worker + prefetch |
| `apps/web/vite.config.ts` | Bundle boundaries |
| `.performance-budgets.json` | Budget definitions |
| `.github/workflows/ci.yml` | CI pipeline |
| `.lighthouserc.json` | Lighthouse config |
