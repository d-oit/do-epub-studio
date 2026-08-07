# ADR-218: Measured Performance Baseline Policy

**Date:** 2026-08-06
**Status:** Proposed
**Deciders:** Project maintainer, performance reviewer
**Related:** GOAP-218, ADR-022, ADR-107, ADR-187, Plan 065

## Context

The repository defines performance targets (FCP 1.2s, chapter-switch 300ms,
offline-rehydrate 800ms) in `.performance-budgets.json` and enforces bundle
budgets via CI scripts. These are static ceilings, not measured regression
baselines:

- No `PerformanceObserver` instrumentation exists in the reader runtime path.
  The only runtime measurement is a single `performance.mark/measure` pair for
  total `reader:load` time (`apps/web/src/lib/client-logger.ts:105-120`,
  consumed at `apps/web/src/features/reader/hooks/useReaderEpub.ts:282`).
- Benchmarks are non-blocking in CI: `ci.yml:557` (`Check for regression`) and
  `ci.yml:565` (`performance-report`) both set `continue-on-error: true`, so
  reader-core regressions merge silently.
- Two competing budget models coexist: raw-byte `bundleSize` and gzipped
  `gzipBudgets` in `.performance-budgets.json`, enforced by different scripts
  (`check-bundle-size.mjs` in `ci.yml`, `check-bundle-budget.mjs` in
  `bundle-size.yml`). ADR-107 §3 numbers (180/30/80 KB] gzipped) drift from the
  configured values (240/30/142 KB).
- The reader route cannot be audited by Lighthouse (auth-protected), so
  reader-specific performance relies on static route budgets and a Playwright
  startup spec.
- The worker-based EPUB pipeline (`createEpubLoader` +
  `parseEpubInWorker` + `archive-validator.ts`) exists in reader-core but is
  not wired into production; `useReaderEpub.ts:118` calls `ePub(epubUrl)`
  directly, keeping parse and ZIP validation on the main thread.

## Decision

### 1. Instrument before optimizing

Every reader pipeline stage — EPUB fetch, unzip, chapter sanitize, chapter
display, offline rehydration, annotation sync — must emit `PerformanceObserver`
marks before any optimization is evaluated. Measurements are the evidence for
optimization claims; a claimed optimization without a measured before/after is
not accepted.

### 2. Percentile-based targets replace point-in-time budgets

Performance targets are p50/p95/p99 per book-size bucket, not single-number
ceilings. Existing `startupTime` values become the **p95 targets**; p50 targets
are 60% of p95.

| Metric | p50 target | p95 target | Book-size bucket |
|---|---|---|---|
| reader-fcp | 720ms | 1200ms | all |
| chapter-switch | 180ms | 300ms | text-only (<5MB) |
| chapter-switch | 240ms | 300ms | image-heavy (>5MB) |
| offline-rehydrate | 480ms | 800ms | all |
| sanitize-chapter | 600ms | 1000ms | all (single spine item) |

### 3. Benchmarks are blocking in CI

The `bench` job removes `continue-on-error: true` from the regression check.
Regressions exceeding the existing 20% threshold in
`scripts/compare-benchmarks.mjs` block merge. A PR label `bench:override`
allows bypass with maintainer approval and a linked issue containing the
baseline measurement justifying the override.

### 4. Single authoritative budget model

The raw-byte `bundleSize` section in `.performance-budgets.json` is removed.
The gzipped `gzipBudgets` model (ADR-107 §3) is the single source of truth.
`scripts/check-bundle-budget.mjs` is the single enforcement script. ADR-107 §3
values are reconciled with current configured values; any deliberate change
is recorded here rather than silently drifting.

### 5. Bundle baseline artifact per route

A committed `bundle-baseline.json` captures per-route gzipped entry-chunk and
total transitive sizes. CI fails on a meaningful delta: >10 KB gzip for entry
chunks or >3% total route growth. Brotli size is reported alongside gzip for
Cloudflare-compatible clients.

### 6. Worker pipeline is the production EPUB path

`createEpubLoader` (with `parseEpubInWorker`, `archive-validator.ts` guards,
parallel navigation+metadata fetch, 30s total timeout) is the canonical EPUB
loading path. Direct `ePub()` calls in `useReaderEpub.ts` are replaced with
the loader. The main-thread fallback exists only where `Worker` is unavailable
(SSR, test environments) and is itself covered by timeout guards.

## Alternatives Considered

### Keep static budgets only

Rejected. Static ceilings hide gradual regressions — a route can grow 50 KB
across 10 PRs without triggering any gate. Measured baselines catch the trend
early.

### Add full OpenTelemetry for reader metrics

Deferred (ADR-217). `PerformanceObserver` + `performance.mark/measure` provides
the same runtime data without the new dependency. OTel remains the future
option for cross-session aggregation.

### Non-blocking benchmarks with trend alerts

Rejected. Alert-only enforcement fosters an ignore-the-alert culture. The 20%
threshold is generous enough to avoid false positives; the `bench:override`
label is the escape hatch.

### Move sanitization to a Web Worker

Deferred. DOMPurify requires synchronous DOM access (content hooks in epub-js);
sanitizer hooks mutate the live document. Incremental caching and windowed
sanitization (GOAP-218 T2.2/T2.3) are the pragmatic optimization. A future
change to epub-js's hook API could enable worker-based sanitization.

## Consequences

### Positive

- Performance claims are backed by measured evidence, not assumptions.
- Regressions are caught at merge time rather than after release.
- Single budget model removes raw-vs-gzipped enforcement confusion.
- Worker pipeline activation improves main-thread responsiveness and applies
  decompression-bomb/path-traversal validation on every load.
- Committed baselines enable meaningful before/after comparisons forever after.

### Negative

- Blocking benchmarks may slow PR merge on noisy CI runners (mitigated by the
  `bench:override` label and 20% threshold).
- `PerformanceObserver` instrumentation adds a small runtime cost (~0.1ms per
  mark/measure — negligible relative to EPUB operations).
- Maintaining the EPUB test corpus adds fixture management overhead.
- Wiring `createEpubLoader` into the web app risks rendition-event regressions
  (mitigated by event-bridge tests, GOAP-218 T2.1).

### Neutral

- This ADR does not change security, offline-sync, or annotation contracts. It
  changes only how performance is measured and enforced.

## Compliance

- AGENTS.md Tier 2: quality gates before commit; benchmark CI job
- ADR-022: coverage and benchmarking — extended with blocking regression gate
- ADR-107: quality gate escalation and DX standards — budget model unified
- ADR-187: fail-closed engineering gates — benchmarks become fail-closed
- Plan 065: reader performance + Turborepo hardening — completes pending items
  (EPUB parse off main thread, measured reader timeline)

## Review Triggers

Revisit this decision when:

- OTel evaluation completes (ADR-217) and may replace `PerformanceObserver`
- epub-js hook API supports async/worker sanitization — may enable the T2.2
  worker path
- The reader route becomes Lighthouse-auditable (auth fixture lands) — may relax
  static budget reliance
- Benchmark blocking causes excessive friction after 2 weeks of operation
  (then tune threshold, not silently disable the gate)
