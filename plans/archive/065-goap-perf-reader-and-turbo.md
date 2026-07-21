# GOAP Plan 065: Reader Performance + Turborepo Cache Hardening

**Date:** 2026-06-01
**Status:** 🟢 Stream A complete (PR #406); 🟢 Stream B PR-1 complete (PR #415); Stream B PR-2/PR-3 + follow-ups pending
**Strategy:** Parallel (two independent streams)
**Related:** Issues #397 (reader perf, P:high), #399 (turbo cache, P:high), #398 (build budget, P:high), #400 (worker perf, P:medium), #401 (observability, P:medium)
**Predecessor:** Plan 064 (preexisting fixes), Plan 062 (final remaining tasks), PR #403 (worker 2026 best practices)

---

## Goal

Address the two high-priority performance issues blocking the reader and CI:

- **#397** — Reduce reader boot cost, chapter-switch latency, and large-list rendering overhead
- **#399** — Improve Turborepo cache hit rate and affected-only execution

Both issues explicitly require **measurable before/after** validation, not subjective improvements.

---

## Outcomes (Measured)

### Stream A — #399 Turborepo cache hardening (PR #406)

| Metric | Before | After | Delta |
|---|---|---|---|
| `globalDependencies` files | 2 | 8 | +6 (pnpm-lock.yaml, pnpm-workspace.yaml, package.json, .npmrc, eslint.config.js) |
| Cold run (--force, 21 tasks) | 2m17s | 2m17s | unchanged |
| Warm run (no source change) | (would have run cold) | **365ms** | **21/21 cached (FULL TURBO)** |
| Repeat warm run | n/a | 361ms | stable |
| `envMode` | implicit | strict | declared |
| `inputs` declared per task | partial (lint/typecheck/test:unit only) | all 7 tasks | complete |
| Stale cache after `pnpm install` | yes (pnpm-lock.yaml not hashed) | no | fixed |

**Status:** PR #406 open, awaiting CI green. Local: lint/typecheck/test:coverage/build all PASS.

### Stream B — #397 Reader performance (PR #415, PR-1)

| Metric | Before | After | Delta |
|---|---|---|---|
| TOC render: 200-chapter EPUB | 200 buttons mounted | ≤~20 mounted (visible window + overscan) | -90% DOM nodes |
| Comments/Highlights render: 200 items | 200 items mounted | ≤~15 mounted (visible window + overscan) | -93% DOM nodes |
| `EpubLoader.load()` await chain | 3 sequential awaits | 1 await (Promise.all) | 2 awaits saved on cold load (~40-100ms) |
| Initial bundle JS (apps/web/dist) | 1.07 MB | 1.07 MB | unchanged (VirtualList ~5KB, lazy) |
| ReaderPage chunk (lazy) | 254 KB | 254 KB | unchanged (no new deps) |
| Tests passing | web 262, reader-core 277 | web 263, reader-core 277 | +1 new test for virtualization |

**Status:** PR #415 open, awaiting CI green. Local: 263/263 web + 277/277 reader-core tests pass.

---

## Follow-ups (P0 wins from explore agent, not in plan 065)

The reader-core explore surfaced four unaddressed bottlenecks in the actual hot path. These are NOT in plan 065's original scope and should be filed as a new issue or a separate plan (e.g., plan 066).

| Rank | File | Change | Expected win |
|---|---|---|---|
| 1 | `annotation-adapter.ts` | Track adapter-owned annotations; remove only those | O(n)→O(k) DOM work per chapter switch |
| 2 | `reanchor.worker.ts` | Multi-worker pool, request-driven chapter loads | 4–8× annotation import throughput |
| 3 | `reanchor.ts`/`reanchor.worker.ts` | Cache word sets in loader/IndexedDB; drop `String(words[i])` cast | 5–20× Pass 2 latency on large books |
| 4 | `sanitizer.ts` | Replace per-attr loop (67 attrs × N elements) with `getAttributeNames` + regex | 5–10× SVG sanitize cost |

## Plan 065 tasks not yet implemented (Stream B PR-2 / PR-3)

- R2: `startTransition` for chapter nav state (low risk, easy win)
- R4: Move heavy EPUB parsing off main thread (verify existing worker integration)
- R5: Manual chunk splitting for `framer-motion` + `jszip` (initial bundle reduction)
- R7: New Playwright perf test asserting reader FMP < 1.5s on 200-chapter fixture

---

## Root Cause / Context

### #397 Reader Performance
- TOC (`TableOfContents.tsx`, 113 LOC) renders all items eagerly. A 200-chapter EPUB creates 200 DOM nodes synchronously.
- CommentsPanel renders all comments/highlights with no virtualization — large annotation sets stall the panel.
- No use of `startTransition` for non-urgent state updates (TOC sync, chapter nav UI).
- ReaderPage (`ReaderPage.tsx`, 355 LOC) is already lazy-loaded via `App.tsx`; the comment/highlight components are not.
- Zustand store usage is fine; no obvious over-broad subscriptions.

### #399 Turborepo Cache
- `turbo.json` is minimal: `build` has explicit `outputs` and `env`, but `lint`, `typecheck`, `test:unit`, `test:e2e` lack explicit `inputs` (some have partial inputs).
- No `globalDependencies` env hashing; `envMode` is implicit.
- Future flags `affectedUsingTaskInputs`, `watchUsingTaskInputs`, `filterUsingTasks` are off.
- CI runs Playwright + Lighthouse + security scans on every PR — not path-aware.

---

## Stream A — #399 Turbo Cache (lower risk, ship first)

| ID | Priority | File | Change | Why |
|----|----------|------|--------|-----|
| T1 | P0 | `turbo.json` | Add explicit `inputs` to `lint`, `typecheck`, `test:unit`, `test:e2e` using `$TURBO_DEFAULT$` plus targeted exclusions | Honest hashing; docs-only changes don't trigger app rebuilds |
| T2 | P0 | `turbo.json` | Declare explicit `outputs` for `test:coverage`, `test:e2e` (currently empty) | Cache verification needs concrete artifact paths |
| T3 | P1 | `turbo.json` | Add `envMode: "strict"` explicitly and audit `env` arrays per task | Prevent implicit env leaking into cache keys |
| T4 | P1 | `turbo.json` | Add `globalDependencies` for `pnpm-workspace.yaml`, `.npmrc`, `package.json` | Workspace-level changes invalidate cache correctly |
| T5 | P1 | `.github/workflows/ci.yml` | Path-aware job skipping: skip Playwright + Lighthouse on `*.md` / `docs/**` only PRs | Fast PR lane for documentation-only changes |
| T6 | P2 | `turbo.json` | Evaluate `affectedUsingTaskInputs` (opt-in flag, document) | Future-leverage — can ship disabled initially |

### Acceptance criteria (Stream A)
- [ ] `pnpm turbo run lint --dry-run=json` shows expected task inputs
- [ ] Repeat `pnpm turbo run build` in CI-equivalent env shows `cache hit` for unchanged inputs
- [ ] No regression in any pnpm test in `apps/*` and `packages/*`

---

## Stream B — #397 Reader Performance

| ID | Priority | File | Change | Why |
|----|----------|------|--------|-----|
| R1 | P0 | `TableOfContents.tsx` | Add windowing threshold (e.g., >50 items, render only visible ±10) using a simple `useState` + `useEffect` scroll listener OR add `react-virtuoso` | Avoid mounting 100+ buttons for long EPUBs |
| R2 | P1 | `ReaderPage.tsx` | Wrap `setActiveTab` / TOC navigation in `React.startTransition` | Mark chapter nav as non-urgent |
| R3 | P1 | `CommentsPanel.tsx` | Apply same threshold logic for annotations/highlights lists | Same as R1, but for annotations |
| R4 | P1 | `ReaderPage.tsx` | Audit `useReaderEpub` (already exists as hook) and ensure EPUB parsing happens in Web Worker (check `epub.worker.ts`) | Move heavy parse off main thread |
| R5 | P2 | `vite.config.ts` | Add manual chunk splitting for `framer-motion` and `jszip` | These are the largest non-React deps; reader should not load admin-only code |
| R6 | P2 | `apps/web` | Add `dist/` size report (use `rollup-plugin-visualizer`, already in devDeps) and save baseline | Required for before/after measurement |
| R7 | P2 | `apps/tests/reader-perf.spec.ts` | New Playwright test: assert reader first-meaningful-paint < 1.5s on a 200-chapter fixture | Acceptance gate per issue #397 AC |

### Acceptance criteria (Stream B)
- [ ] Reader route initial JS bundle (gzipped) decreases vs main baseline
- [ ] Chapter switch remains responsive (TBT < 200ms) on a long-TOC fixture
- [ ] Long lists no longer render all items at once (verify via `getByRole` count < 50)
- [ ] No regressions in existing `reader-annotations-and-admin.spec.ts` tests
- [ ] Bundle report artifact attached to PR

---

## Risks & Mitigations

- **Risk: `react-virtuoso` adds 30KB+ to bundle** — Mitigation: R1 uses native scroll-listener first; R3 evaluates virtuuso only if R1 insufficient.
- **Risk: `startTransition` changes existing test timing** — Mitigation: R2 only wraps non-critical UI state; query `findByText` instead of `getByText` in affected tests.
- **Risk: turbo path-aware CI breaks expected job runs** — Mitigation: ship T5 only after manual verification on a test PR; revert fast if any required job is skipped.

---

## Execution Plan

1. **Sequential within each stream** (Stream A first since lower risk)
2. **Stream A ships in single PR** (turbo.json + ci.yml + measurements)
3. **Stream B ships as 2-3 PRs**:
   - PR-1: R1+R3 (list virtualization) + bundle baseline (R6)
   - PR-2: R2+R4 (startTransition + worker parse)
   - PR-3: R5+R7 (chunking + perf test)
4. **Coordination**: update this plan after each PR merges; record actual numbers in `agents-docs/LEARNINGS.md` via the `learn` skill

---

## Open Questions

- Should we adopt `react-virtuoso` (~30KB) or roll a native windowed list? Issue AC allows either; native preferred for bundle.
- Does `wrangler types` re-generate the `worker-configuration.d.ts`? If yes, the eslint ignore added in PR #403 is durable.
- For T5 path-aware CI: what is the current Playwright/Lighthouse job trigger list? (Need to read `.github/workflows/ci.yml` lines for `on:` filters.)

---

## Next Steps

- [ ] Read `.github/workflows/ci.yml` to confirm T5 scope
- [ ] Baseline `pnpm build` in `apps/web` — record dist sizes
- [ ] Implement Stream A T1-T4
- [ ] Implement Stream B R1 (TOC windowing) using native scroll listener
- [ ] Measure, commit, request review
