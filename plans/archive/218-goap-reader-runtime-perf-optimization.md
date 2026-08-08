# GOAP 218: Reader Runtime Performance Optimization Swarm

**Date:** 2026-08-06
**Status:** Completed (Waves 1–4 via PRs #924/#925/#930; bundle-baseline artifact wiring and `createEpubLoader` wrapper decision carried to plan 221)
**Goal:** Replace broad budget ceilings with measured regression baselines,
instrument the EPUB reader runtime path, and optimize the critical rendering
pipeline using a coordinated swarm of agents.
**Related:** ADR-218, Plan 065, Plan 216, ADR-022, ADR-107, ADR-187

## 1. Analysis

### Current State (verified on `main`)

The repository has strong optimization infrastructure — Turborepo caching
(`turbo.json` explicit `inputs` for all 7 tasks, remote cache in CI), bundle
budgets (`.performance-budgets.json` raw-byte + gzipped models), Lighthouse
budgets (`.lighthouserc.json` mobile preset, catalog/admin/login), and
reader-core benchmarks (`reader-core.bench.ts`, `sanitizer.bench.ts` with
20% regression threshold in `scripts/compare-benchmarks.mjs`). The highest-value
gaps are:

| Gap | Evidence (file:line) | Impact |
|---|---|---|
| Worker pipeline not wired into production | `createEpubLoader` + `parseEpubInWorker` exist in `packages/reader-core/src/epub-loader.ts:136-137` and `epub-parser-worker.ts` but `apps/web/src/features/reader/hooks/useReaderEpub.ts:118` calls `ePub(epubUrl)` directly | EPUB parse, ZIP validation, and archive security run on main thread |
| No PerformanceObserver usage | Zero codebase hits; only `performance.mark/measure` for a single `reader:load` measure in `apps/web/src/lib/client-logger.ts:105-120` consumed at `useReaderEpub.ts:282` | Cannot track p50/p95/p99 for chapter switch, sanitize, rehydrate |
| Sanitization re-runs every chapter | `sanitizeEpubDocument` in `packages/reader-core/src/sanitizer.ts:408-450` runs full 3-pass DOMPurify pipeline per content-hook invocation; only `cachedConfig` (line 323) is memoized, not output | Redundant CPU on re-visits; 5s deadline budget consumed repeatedly |
| Annotations re-render on every event | `renderHighlights`/`renderCommentMarkers` in `annotation-adapter.ts` invoked on every `relocated` + `displayed` in `useReaderEpub.ts:300-332`, no batching | O(n) DOM work per chapter nav for annotation-dense books |
| Benchmarks non-blocking in CI | `.github/workflows/ci.yml:557` and `:565` set `continue-on-error: true` on regression check + report | Regressions silently merge |
| Two competing budget models | Raw-byte `bundleSize` + gzipped `gzipBudgets` in `.performance-budgets.json`; ADR-107 §3 numbers (180/30/80 KB, plan 107:41-43) differ from configured 240/30/142 KB | Confusion; enforcement drift |
| No selective prefetch | `apps/web/src/sw.ts` caches `/api/files/` eagerly (lines 121-132); chapter rendering does not prefetch next spine item | Wasted bandwidth; offline quota pressure |
| Search uses epub-js built-in find | `useReaderSearch.ts` calls `spine.each()` + `item.find()` — no FTS, no virtualization; `MAX_RESULTS=50` caps output | Slow on large books |

### Key Architectural Insight

**Two coexisting pipelines:** the canonical `createEpubLoader` wrapper (workers,
30s `withTimeout`, parallel navigation+metadata fetch via `Promise.all`) exists
in reader-core, but the live app path instantiates `@intity/epub-js` directly.
Closing this gap is the single highest-impact optimization — it moves EPUB parse
and ZIP validation (including `archive-validator.ts` decompression-bomb and
path-traversal guards) off the main thread for free.

### Constraints

- ADR-006: multi-signal locators (CFI + text + chapter) must be preserved
- ADR-034: all regex on untrusted input via `matchBounded`/`testBounded`
- ADR-035: CSP; sanitizer is primary XSS guard — caching must not weaken it
- ADR-005: offline sync queue semantics unchanged
- Coverage: reader-core 72% lines / 70% functions (AGENTS.md)
- Max 500 LOC per source file (AGENTS.md TIER 3)
- AGENTS.md TIER 1: worker pipeline keeps main-thread fallback for SSR/tests

## 2. Decomposition — Swarm Tasks

### Wave 1: Instrument & Baseline (parallel, independent)

| Task | ID | Agent | Key files | Acceptance |
|---|---|---|---|---|
| PerformanceObserver marks | T1.1 | reader-ui-ux | `apps/web/src/lib/client-logger.ts`, `useReaderEpub.ts`, `useReaderSearch.ts`, `useReaderDataLoader.ts`, `stores/reader.ts` | `PerformanceObserver` marks for: `epub-fetch`, `epub-unzip`, `sanitize-chapter`, `display-chapter`, `rehydrate-offline`, `sync-annotations`; p50/p95/p99 per book-size bucket emitted to telemetry via `logClientEvent` |
| EPUB test corpus | T1.2 | testdata-builders | `packages/reader-core/src/__fixtures__/`, `scripts/build-test-corpus.mjs` | 5 EPUBs: small text-only, image-heavy, many-chapter (200+), malformed/hostile markup, annotation-dense (500+ highlights); generated via script (never tracked binaries, per AGENTS.md) |
| Baseline benchmarks | T1.3 | testing-strategy | `packages/reader-core/src/reader-core.bench.ts`, `sanitizer.bench.ts`, `.github/workflows/ci.yml`, `packages/reader-core/package.json` | Benchmarks cover openBook, loadChapter, sanitizeChapter, displayChapter, rehydrateOffline, syncAnnotations on corpus; `baseline.json` checked in; CI regression gate **blocking** (remove `continue-on-error` at ci.yml:557, add `bench:override` label escape, per ADR-218 D3) |
| Bundle baseline artifact | T1.4 | code-quality | `scripts/check-bundle-budget.mjs`, `.performance-budgets.json`, new `bundle-baseline.json` | Per-route gzipped baseline JSON committed; CI fails on >10 KB gzip delta for entry chunks or >3% total route growth; Brotli reporting added alongside gzip (per ADR-218 D5) |

### Wave 2: Wire Worker Pipeline (sequential chain, depends on Wave 1)

| Task | ID | Agent | Key files | Acceptance |
|---|---|---|---|---|
| Wire `createEpubLoader` into web app | T2.1 | epub-rendering-and-cfi | `useReaderEpub.ts`, `packages/reader-core/src/epub-loader.ts` | Replace `ePub(epubUrl)` at useReaderEpub.ts:118 with `createEpubLoader().load()`; worker parse active with main-thread fallback; 30s timeout preserved; rendition event bridge (`relocated`/`displayed`/`attached`/`started`) preserved; all existing tests pass |
| Sanitization caching | T2.2 | epub-rendering-and-cfi | `packages/reader-core/src/sanitizer.ts`, new `sanitizer-cache.ts` | Cache sanitized chapter output keyed by `bookRevision + spineItemHref + sanitizerPolicyVersion`; LRU max 10 entries; cache hit skips 3-pass pipeline; stale-on-revision-change; never caches `script`/`style` remnants (sanitizer invariants reinforced, per ADR-035) |
| Incremental sanitization window | T2.3 | epub-rendering-and-cfi | `packages/reader-core/src/sanitizer.ts`, `useReaderEpub.ts` | Sanitize current + prev/next spine items only at display; remaining chapters sanitized on `requestIdleCallback`; priority respects reading direction (RTL aware via `bookDirection`) |

### Wave 3: Optimize Runtime Path (parallel, depends on Wave 2)

| Task | ID | Agent | Key files | Acceptance |
|---|---|---|---|---|
| Virtualize annotation rendering | T3.1 | reader-ui-ux | `useReaderEpub.ts`, `annotation-adapter.ts` | Batch `renderHighlights`/`renderCommentMarkers` in `requestAnimationFrame`; suspend offscreen annotation painting until chapter idle; debounce `relocated` handler to 100ms (respecting reader spread/zoom state) |
| Selective prefetch | T3.2 | pwa-offline-sync | `sw.ts`, `useReaderEpub.ts`, new `prefetch-manager.ts` | Prefetch next spine item at low priority (`fetchPriority: 'low'`) after 500ms chapter idle; network-aware (`navigator.connection.effectiveType`, skip 2G/save-data); storage-quota-aware via `navigator.storage.estimate()`; no eager full-book download; respects service-worker denylist semantics |
| Virtualize search results | T3.3 | reader-ui-ux | `useReaderSearch.ts` | Viewport-windowed results; lazy-highlight only visible results (`highlightRanges` capped at existing `SNIPPET_EXCERPT_MAX=2000`); no layout thrash; existing 250ms debounce + `MAX_RESULTS=50` kept |
| Bundle boundary enforcement | T3.4 | code-quality | `apps/web/vite.config.ts`, `scripts/check-bundle-size.mjs` | CI assertion: catalog/auth shell never imports reader-core through shared barrels; `epubjs`, reader rendering, annotation editor, search, admin are independently lazy-loaded boundaries; `chunkSizeWarningLimit` set in vite config |

### Wave 4: CI & Budget Hardening (parallel, after Wave 3)

| Task | ID | Agent | Key files | Acceptance |
|---|---|---|---|---|
| Unified budget model | T4.1 | code-quality | `.performance-budgets.json`, `scripts/check-bundle-budget.mjs`, `scripts/check-bundle-size.mjs` | Remove raw-byte `bundleSize`; single gzipped model; require scripts to agree with ADR-107 §3 values (180/30/80 KB) or supersede ADR-107 with explicit ADR-218 reference; one enforcement script |
| Split CI fast/full checks | T4.2 | cicd-pipeline | `.github/workflows/ci.yml`, `turbo.json` | PR checks: changed-package fast checks (scoped Turbo `lint`+`typecheck`+targeted `test:unit`); merge-queue: full coverage + cross-browser smoke + Lighthouse; `verify:fast` uses scoped Turbo task instead of raw `vitest run --changed main` |
| Trend tracking | T4.3 | cicd-pipeline | `.github/workflows/ci.yml`, `scripts/report-performance.mjs` | Upload and trend across runs: task durations, cache-hit ratio (via `turbo run --dry-run=json`), bundle deltas, flaky-test rates; PR comment shows trend, not just point-in-time |
| Lighthouse reader route | T4.4 | cicd-pipeline | `.lighthouserc.json`, `.github/workflows/lighthouse.yml` | Auth fixture for reader route (seeded preview env per Plan 216 out-of-scope note); reader-specific mobile assertions: performance ≥0.6, FCP ≤1200ms, interactive ≤4000ms |

## 3. Execution Strategy

**Hybrid swarm** per ADR-212 and GOAP execution strategies
(`references/execution-strategies.md`):

- **Wave 1:** fully parallel — 4 agents on disjoint file sets (client-logger/
  hooks, fixtures, benchmarks, bundle scripts)
- **Wave 2:** sequential chain — T2.1 → T2.2 → T2.3 (each depends on the prior
  wiring)
- **Wave 3:** parallel — 4 agents (annotations, prefetch, search, bundle
  boundaries), independent after Wave 2 lands
- **Wave 4:** parallel — 4 agents (budget model, CI split, trends, Lighthouse),
  independent infrastructure work

Quality gates between waves:
1. After Wave 1: `./scripts/quality_gate.sh`; baselines exist and are committed
2. After Wave 2: `pnpm --filter @do-epub-studio/reader-core test` +
   `pnpm --filter @do-epub-studio/web test`; performance spec passes with new marks
3. After Wave 3: `./scripts/quality_gate.sh` + bundle budget checks +
   `pnpm bench` comparison (no regression)
4. After Wave 4: full CI green on PR (`gh pr checks`)

## 4. Swarm Agent Assignments

| Agent type | Tasks | Rationale |
|---|---|---|
| `reader-ui-ux` | T1.1, T3.1, T3.3 | Reader component rendering, annotation virtualization, search UI |
| `epub-rendering-and-cfi` | T2.1, T2.2, T2.3 | EPUB pipeline wiring, sanitizer caching, content hooks (ADR-006 scope) |
| `testing-strategy` | T1.3 | Benchmark design, regression thresholds, CI gating |
| `testdata-builders` | T1.2 | EPUB corpus generation, fixture management, schema-entity builders |
| `code-quality` | T1.4, T3.4, T4.1 | Bundle analysis, boundary enforcement, budget consolidation |
| `cicd-pipeline` | T4.2, T4.3, T4.4 | CI split, trend tracking, Lighthouse auth fixture |
| `pwa-offline-sync` | T3.2 | Network-aware prefetch, storage quota, SW integration |

## 5. Out of Scope (recorded, not deferred silently)

- **Full-text search engine replacement** — epub-js `find()` sufficient for
  <200-chapter books; FTS5 server-side search exists for catalog. Dedicated
  reader-core FTS is a separate initiative.
- **framer-motion lazy loading** — deferred from Plan 065; not reader-path
  critical.
- **OTel evaluation** — deferred per ADR-217; `PerformanceObserver` telemetry
  (T1.1) is the interim solution.
- **Web Worker for sanitization** — DOMPurify requires synchronous DOM access
  (content hooks). Incremental caching (T2.2) + windowed sanitization (T2.3)
  are the pragmatic optimization; worker sanitization requires epub-js hook API
  change.

## 6. Acceptance Criteria

- [ ] `PerformanceObserver` marks emitted for all 6 reader pipeline stages
- [ ] EPUB test corpus (5 books) committed with fixture builder script
- [ ] Baseline benchmarks checked in; CI regression gate **blocking**
- [ ] `createEpubLoader` wired into `useReaderEpub.ts`; worker pipeline active
- [ ] Sanitization cache reduces repeat chapter load by ≥50% (measured)
- [ ] Incremental sanitization limits initial load to current+adjacent chapters
- [ ] Annotation rendering batched in rAF; no layout thrash on chapter nav
- [ ] Selective prefetch respects network/storage constraints
- [ ] Single authoritative gzipped budget model; stale raw-byte model removed
- [ ] CI split: fast PR checks + full merge-queue checks
- [ ] All existing tests pass; reader-core coverage ≥72% lines / 70% functions
- [ ] Bundle baseline artifact committed; delta enforcement active
- [ ] No new `any` types; no new files >500 LOC

## 7. Risk Register

| Risk | Mitigation |
|---|---|
| Wiring `createEpubLoader` breaks rendition events | Event-bridge tests in T2.1 comparing direct-`ePub` behavior; rollback to direct call |
| Sanitization cache serves stale content | Cache keyed on revision + policy version; stale-on-revision-change; sanitizer invariants re-tested |
| PerformanceObserver unavailable in some browsers | Guard with `typeof PerformanceObserver !== 'undefined'`; fallback to `performance.mark/measure` |
| Benchmark blocking causes CI friction | 20% regression threshold retained; `bench:override` PR label; exact delta in PR comment |
| Prefetch wastes mobile bandwidth | Network-aware (skip 2G/save-data) + storage-quota-aware; low priority |
| Caching weakens CSP/XSS posture | Cache only post-`sanitizeEpubDocument` output; XSS test suite re-run on cache path (per security-code-auditor) |

## 8. Critical Files

| File | Role |
|---|---|
| `apps/web/src/features/reader/hooks/useReaderEpub.ts` | Primary EPUB lifecycle (T2.1) |
| `packages/reader-core/src/epub-loader.ts` | Worker-backed loader (T2.1) |
| `packages/reader-core/src/sanitizer.ts` | DOMPurify + deadline pipeline (T2.2, T2.3) |
| `packages/reader-core/src/epub-parser-worker.ts` | Parse worker pool (T2.1) |
| `apps/web/src/lib/client-logger.ts` | Performance marks (T1.1) |
| `apps/web/src/features/reader/hooks/useReaderSearch.ts` | Search results (T3.3) |
| `apps/web/src/features/reader/hooks/useReaderDataLoader.ts` | Offline rehydration (T1.1) |
| `apps/web/src/lib/offline/db.ts` | IndexedDB schema (T3.2) |
| `apps/web/src/sw.ts` | Service worker + prefetch (T3.2) |
| `.performance-budgets.json` | Budget definitions (T4.1) |
| `.github/workflows/ci.yml` | CI pipeline (T4.2, T4.3) |
| `.lighthouserc.json` | Lighthouse config (T4.4) |
| `packages/reader-core/src/annotation-adapter.ts` | Annotation rendering (T3.1) |
| `packages/reader-core/src/reader-core.bench.ts` | Benchmarks (T1.3) |

## 9. Verification

1. **Wave 1:** `pnpm bench` runs new baselines; `baseline.json` committed;
   `PerformanceObserver` marks visible in browser DevTools; telemetry events
   contain p50/p95/p99 metadata
2. **Wave 2:** DevTools Performance tab shows `epub-parse` on a worker thread;
   chapter switch <300ms p95; repeat chapter visit shows sanitizer cache hit
3. **Wave 3:** annotation-dense book nav smooth (no dropped frames); prefetch
   request appears in Network tab after 500ms idle; search results scroll
   without layout thrash
4. **Wave 4:** `gh pr checks` shows split fast/full lanes; PR comment includes
   trend data; bundle delta enforcement catches an intentional regression
