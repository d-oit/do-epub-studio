# GOAP 221: Consolidated Remaining Audit Items

**Date:** 2026-08-08
**Status:** ✅ COMPLETED (221-A1+A2 via PR #936; 221-A3 via PR #937; 221-A4/A5/A6 in backlog; CI regression fix via GOAP-222)
**Goal:** Consolidate every verified-open recommendation from completed plans
212–220 into one actionable backlog with evidence, so no item survives only as
a stale status line or an out-of-scope note.
**Related:** Plan 212, Plan 214, Plan 215, ADR-214, ADR-215, ADR-217, ADR-218,
`plans/archive/218-goap-reader-runtime-perf-optimization.md`,
`plans/archive/219-goap-wave3-4-implementation.md`,
`plans/archive/220-goap-missing-impl-overclaimed-and-a11y.md`

## 1. Analysis

### Method

Every active plan in `plans/` was re-verified against `main` (commit `0ce36cf`)
by direct code inspection. Plan status lines and ADR-INDEX claims were treated
as untrusted: each "completed" claim was confirmed against source files.

### Corrections discovered during verification

- Plan 219's Wave 1–2 list claims `createEpubLoader` wired into
  `useReaderEpub.ts` — the **goal** (worker-side EPUB parse) is met via
  `parseEpubInWorker` at
  `apps/web/src/features/reader/hooks/useReaderEpub.ts:121`, but the
  `createEpubLoader` wrapper itself is referenced only by tests/benchmarks.
- Plan 219 claims "Bundle baseline artifact with Brotli reporting ✓" — the
  generator `scripts/bundle-baseline.mjs` exists, but no
  `bundle-baseline.json` artifact is committed and no CI delta check consumes
  it.
- Plan 216 recorded the LHCI auth fixture as an out-of-scope follow-up — it is
  now done (`lighthouse/auth-reader-fixture.mjs` wired in `.lighthouserc.json`
  covering `/admin` and `/read/test-book`).

### Verified strengths (no action)

- Worker EPUB parse pipeline in production (`parseEpubInWorker`)
- PerformanceObserver marks, selective prefetch, EPUB test corpus, blocking
  benchmark regression gate (per ADR-218 D3)
- i18n drift prevention (plan 098: helpers, snapshot test, `@smoke` tags)
- Lighthouse auth fixture for protected routes

## 2. Remaining Items

| ID | Pri | Source | Item | Evidence |
| --- | --- | --- | --- | --- |
| 221-A1 | P2 | 218-T1.4 | Commit `bundle-baseline.json` artifact and wire CI delta enforcement (>10 KB gzip entry chunk, >3% route growth per ADR-218 D5) | `scripts/bundle-baseline.mjs` exists; no artifact, no CI consumer |
| 221-A2 | P2 | 218-T2.1 | Resolve `createEpubLoader` dead abstraction: wire it into `useReaderEpub.ts` or remove the wrapper (keep `parseEpubInWorker` path) | `packages/reader-core/src/epub-loader.ts:136-137`; only tests/bench import it |
| 221-A3 | P2 | 218-T2.2 | Complete sanitizer cache: LRU max 10 keyed by `bookRevision + spineItemHref + sanitizerPolicyVersion`; re-run XSS sanitizer suite | `packages/reader-core/src/sanitizer.ts:272,407-428` (partial in-module cache only) |
| 221-A4 | P3 | 215-N6 | UI polish bundle: page-level skeletons (spinner-only today), centralized keyboard shortcuts module, app-level Storybook decision | `apps/web/src/components/PageLoadingFallback.tsx:9-32`; scattered `keydown` handlers; Storybook only in `packages/ui` |
| 221-A5 | P2 | 215-R10 | Admin reading-insights aggregation after privacy review (ADR-102b); paginated, no raw reader timelines | `apps/worker/src/routes/reader/insights.ts:25` per-book only; admin `stats.ts` has no insights aggregation |
| 221-A6 | P3 | 215-N7 / ADR-217 | OpenTelemetry evaluation writeup: accept, reject, or scope OTel vs custom traceparent | `packages/shared/src/telemetry.ts`; ADR-217 defers the decision |

### Gated (no public work until private triage closes)

| ID | Item | Gate |
| --- | --- | --- |
| R1 | Private email transport/token triage (T0.1) | ADR-214 D4, ADR-215 D4 |
| R12 | Email delivery health/retry/bounce observability | R1 |
| N3 | Invite emails + transactional templates in `createGrant` | R1, R12 |

### Explicitly deferred (no action scheduled)

- ADR-199: i18n plural rules
- ADR-217: OTel decision itself (221-A6 is only the evaluation writeup)

## 3. Decomposition — Waves

### Wave 1: Bundle/loader infrastructure (parallel, small)

| Task | Item | Key files |
| --- | --- | --- |
| W1.1 | 221-A1 baseline artifact + CI delta check | `scripts/bundle-baseline.mjs`, `.github/workflows/ci.yml`, new `bundle-baseline.json` |
| W1.2 | 221-A2 wire-or-remove `createEpubLoader` | `apps/web/src/features/reader/hooks/useReaderEpub.ts`, `packages/reader-core/src/epub-loader.ts` |

### Wave 2: Sanitizer cache (after Wave 1, security-adjacent)

| Task | Item | Key files |
| --- | --- | --- |
| W2.1 | 221-A3 LRU sanitizer cache + XSS suite re-run | `packages/reader-core/src/sanitizer.ts`, new `sanitizer-cache.ts` |

### Backlog (unscheduled)

221-A4 (UI polish), 221-A5 (admin insights aggregation), 221-A6 (OTel
evaluation writeup).

## 4. Execution Strategy

One PR per wave. Each PR passes `./scripts/quality_gate.sh`, keeps files ≤500
LOC, and updates this plan's status in the same commit. W2.1 follows the 218
risk register: cache only post-`sanitizeEpubDocument` output; sanitizer
invariant tests re-run on the cache path.

## 5. Acceptance Criteria

- [x] 221-A1: `bundle-baseline.json` committed; CI fails on budget delta (PR #936)
- [x] 221-A2: no dead `createEpubLoader` abstraction — wired via `getBook()` accessor (PR #936)
- [x] 221-A3: sanitizer cache hit skips 3-pass pipeline; revision/policy change invalidates; XSS suite green (PR #937)
- [ ] 221-A4: centralized keyboard shortcuts + page-level skeletons (PR #941)
- [ ] 221-A5: admin reading-insights aggregation endpoint (PR #941)
- [x] 221-A6: OTel evaluation writeup satisfied by ADR-217 (`plans/217-adr-opentelemetry-evaluation.md`) — accepted-defer decision with explicit revisit criteria; no new code needed
- [x] Gated R1/R12/N3 remain untouched until private triage closes
- [x] `node scripts/check-adr-index.mjs` and markdownlint pass on `plans/`
