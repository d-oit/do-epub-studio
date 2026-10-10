# ADR-312: Benchmark regression gate — 30% threshold with combined-rme noise bars

**Date:** 2026-10-10
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** ADR-218 (amended §3), ADR-022, ADR-277, GOAP-1006,
`plans/1006-goap-scheduled-e2e-repairs.md`, `scripts/compare-benchmarks.mjs`

## Context

ADR-218 §3 made the `Benchmark` CI job blocking: any benchmark that regressed
more than 20 % in ops/s failed merge, with a `bench:override` label as the
escape hatch. That ADR also recorded an explicit review trigger: "Benchmark
blocking causes excessive friction after 2 weeks of operation (then tune
threshold, not silently disable the gate)."

Operational evidence (2026-10-09/10) shows the trigger fired:

- The mandatory `Benchmark` job failed `Check for regression` on PR #1294 with
  `sanitizeEpubDocument (5000 elements)` at **−20.99 %** — while two paired
  local runs of the same head against `main` measured **no difference** (means
  2018/2001 ms vs 2030/1972 ms), and in the _same_ CI comparison benchmarks
  the PR cannot touch also moved hard: `createEpubLoader (no load)` −14.49 %,
  `clone only (baseline)` −18.65 %, `sanitizeDom (2000)` −10.51 %,
  `sanitizeEpubDocument (500)` −19.68 %. Re-running the identical job passed.
- Reported per-benchmark rme (relative margin of error) on that runner reached
  **±28.55 %**; the jsdom benches take 0.5–2 s per sample with ~10 samples and
  run two workers on a shared GitHub runner, so measurement noise spans the
  entire 20 % gate band.
- The same noise that produced a false positive can hide a true 20–25 %
  regression inside the error bars — the gate was simultaneously too tight
  (false blocks) and unsound (false greens).

## Decision

1. **Threshold: 20 % → 30 %** ops/s drop, still blocking. The deterministic
   order of severity is unchanged; ADR-218 §3's blocking intent and the
   `bench:override` escape hatch remain.
2. **A drop is a regression only when it clears both bars**: the 30 % policy
   threshold **and** the combined relative margin of error of the two runs
   (`rme_baseline + rme_head`). A drop inside the noise band is reported as
   `≈` and never fails: the measurement cannot distinguish it from noise.
3. **The table publishes both rme values** so the verdict is auditable from
   the PR comment, not just from the job log.
4. **One source for the default.** The threshold default lives in
   `scripts/compare-benchmarks.mjs`; CI passes no override argument. The
   decision table is pinned by `scripts/__tests__/compare-benchmarks.test.mjs`.
5. **Warn, do not fail, on under-threshold noise-visible drops** (`⚠️`) —
   visibility without gate friction.

## Alternatives considered

- **Keep 20 % and accept re-runs.** Rejected: the observed noise band is wider
  than the band the gate guards, so blocking on noise is the norm, and every
  re-run is a manual, undocumented override.
- **Make the check non-blocking again.** Rejected by ADR-218's rationale
  (alert-fatigue) and its own review trigger, which says tune the threshold —
  not silently disable the gate.
- **Per-benchmark thresholds.** Deferred: needs a noise study per benchmark and
  per-benchmark policy entries; the combined-rme bar already adapts per
  benchmark from the runs' own error bars.
- **Reduce noise at the source** (single-fork bench runs, more iterations,
  pinned runners). Complementary, not substituted: it is the first follow-up if
  false positives recur (see Review Triggers).

## Consequences

### Positive

- The gate fails on evidence, not on scheduler jitter; the #1294-class false
  block (≈ −21 %) can no longer merge-block.
- The noise floor is per-run and self-calibrating: a quiet runner needs only a
  30 % drop to fail; a noisy one demands the drop exceed its own error bars.
- rme columns in the PR comment make the verdict auditable.

### Negative

- A true 20–30 % regression with clean error bars now passes as `⚠️`. Accepted:
  the previous 20 % bound was unenforceable on this fleet — the false-negative
  rate of a gate that fails randomly is 100 % on trust.

### Neutral

- No change to the benchmark suite, its runtime, or the `bench:override`
  mechanism; GOAP-277 A3's "gate actually executes" guarantee is preserved.

## Compliance

- ADR-218 review trigger honoured (tuned, not disabled); amendment recorded
  in ADR-218 §3.
- ADR-022 (coverage and benchmarking): extended, not replaced.
- AGENTS.md Tier 2 quality gates: `Benchmark` remains blocking.

## Review Triggers

Revisit when:

- a false positive recurs despite the noise bar → the next lever is bench-harness
  noise (single fork, higher sample counts, pinned runners), then per-benchmark
  thresholds — not another silent bump;
- a real regression is missed between 20 % and 30 % with clean error bars;
- the runner fleet changes materially (self-hosted, larger runners).
