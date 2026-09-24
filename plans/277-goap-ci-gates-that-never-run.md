# GOAP-277: `e2e-smoke` and `bench` never execute — close the silent-skip gate gap

**Status:** DONE (this PR — A1–A5 all met; sensor lands here, issue #1193 closes)
**Date:** 2026-09-23
**Related:** ADR-277, ADR-201 (WebKit smoke on every PR), ADR-218 (blocking
benchmark regression gate), ADR-083 (number space), GOAP-267 (the `build`
cascade this descends from), GOAP-264 (PR swarm triage that documented the
first half of it), issue #1192 (the PR that surfaced it), issue #1193

## Goal

Make every CI job whose scope filter matches **actually run**, and make a
silently-skipped gate impossible to read as a passing one. Today two
gating jobs report `skipped` in every run sampled while their scope filter
was `true`, so neither ADR-201's per-PR WebKit smoke nor ADR-218's blocking
benchmark check is being enforced at all.

## Evidence (2026-09-23, GitHub Actions API)

| Run | Event / ref | `changes` outputs | `build` | `e2e-smoke` | `bench` | `performance-report` |
| --- | --- | --- | --- | --- | --- | --- |
| 35904962392 | `pull_request` #1192 (`packages/reader-core/src/**`) | `src`, `reader-core` = true | 22 ✅ 24 ✅ | **skipped** | **skipped** | success |
| 35877328351 | `pull_request` (GOAP-273 B1 branch) | src/reader-core changed | 22 ✅ 24 ✅ | **skipped** | **skipped** | success |
| 35860573400 | `pull_request` (GOAP-273 B1 branch) | src/reader-core changed | 22 ✅ 24 ✅ | **skipped** | **skipped** | — |
| 35861505430 | `pull_request` (GOAP-273 B1 branch) | src/reader-core changed | — | **skipped** | **skipped** | success |
| 35897388389 | `pull_request` (docs branch) | — | — | **skipped** | **skipped** | success |
| 35888682922 | `push` main (#1189 merge) | `Filter src = true`, `Filter reader-core = true` | 22 ✅ 24 ✅ | **skipped** | **skipped** | skipped (push) |
| 35866765673 | `pull_request` (pre-`build`-guard) | — | skipped | **skipped** | **skipped** | — |

Observations, all API-verified against `.github/workflows/ci.yml` at the run's
`head_sha` (file byte-identical to the local copy):

1. The scope filter **matched** in every row where `e2e-smoke`/`bench`
   skipped — `dorny/paths-filter` logged `Changes output set to
   ["src","reader-core",…]`, so `needs.changes.outputs.src == 'true'` held.
2. `build`'s legs had already completed `success` (18:55:24 / 18:55:38) when
   `e2e-smoke` and `bench` were evaluated `skipped` four seconds later
   (18:55:42), so the skip is not a race with `build`.
3. `e2e-smoke` and `bench` are the **only two jobs in the workflow that
   `needs: build` without an `always()` guard** (both use
   `needs: [changes, build]`). The one job that also needs `build` but carries
   `always()` — `performance-report` — is the only one of the three that runs
   on PRs. The correlation is exact across seven runs.
4. Consequence: ADR-201's "WebKit caught on every PR" and ci.yml's own comment
   ("CI covers smoke via `e2e-smoke` (main pushes) + `e2e-full` (scheduled)")
   are both false today; `e2e-full` (cron) is the only lane that still runs
   browsers. ADR-218's blocking `compare-benchmarks.mjs` check is dead in the
   same way — `bench` never runs, so no PR can fail on a >20 % ops/s
   regression.
5. Documentation already contradicts itself: `agents-docs/LEARNINGS.md` §261
   ("don't assume `e2e-smoke` covers PR smoke") vs the 2026-09-23 addendum on
   §502 ("let `e2e-smoke` cover it: that job runs on `pull_request`").
   The evidence supports §261.

## Hypothesis (proven 2026-09-23)

`build` only runs at all because of its own fail-closed guard added after
GOAP-267 (`if: always() && !contains(needs.*.result,'failure') && !contains
(needs.*.result,'cancelled')`, needed because `lint`/`typecheck`/`test` are
`if: github.event_name != 'pull_request'` and therefore skip on every PR).
`e2e-smoke` and `bench` were never given the mirror of that guard, so the
same cascade that used to skip `build` now stops one level downstream.
GitHub exposes no skip reason through the API (`annotations_count: 0`, no logs
for skipped jobs), so the mechanism is inferred from the correlation in (3),
not read from the platform. A1 is what turns the hypothesis into evidence.

**A1 did exactly that — the hypothesis is confirmed.** With the guard added
(#1196) and `dorny/paths-filter` reporting the matching scope, both jobs
executed for the first time in sampled history (run
`35912896951`): `E2E Smoke Tests` → `success`, 15 steps; `Benchmark` →
`success`, 11 steps. The paired control is PR #1196 itself (run
`35911442657`), workflow-only: `Filter src = false`, `reader-core = false`,
both jobs `skipped`, `steps=0` — i.e. the guard removed the cascade while
the scope filter kept its designed power to skip. A future regression to
the old state is caught by A4's `Gate Visibility Sensor`, which fails on
exactly that one state and was proven both ways (green on #1200, red on
#1201 — both throwaway, closed unmerged).

## Decomposition

| ID | Action | Exit criteria |
| --- | --- | --- |
| A1 | Give `e2e-smoke` and `bench` the same fail-closed guard `build` uses: `always() && !contains(needs.*.result, 'failure') && !contains(needs.*.result, 'cancelled')` ANDed with their existing scope/event conditions (never dropping the scope filter — a guard must not make a docs-only PR run 20 min of Playwright). | A PR touching `packages/**` shows both jobs with steps instead of `steps: []`; a docs-only PR still shows them skipped. |
| A2 | Run the newly-enabled `e2e-smoke` and fix whatever it reveals (it has not executed in the sampled history, so its real state is unknown). Local cannot help: this container installs **no** Playwright browser (see LEARNINGS §502), so this is CI-driven iteration. | `e2e-smoke` green on the A1 PR; findings either fixed or filed. |
| A3 | Run `bench` and confirm ADR-218's blocking `compare-benchmarks.mjs` actually executes and passes on an unchanged PR. | `Benchmark` job shows the three steps (baseline/head/compare) with conclusion `success`. |
| A4 | Sensor per ADR-277: a check that fails when a scoped gating job is skipped while its filter matched, so this class of gap cannot silently recur. | New check green on a matching PR, red in a deliberate canary where the job is skipped. |
| A5 | Correct the false claim in `agents-docs/LEARNINGS.md` §502 and record the verified finding; reconcile §261 with the post-`build`-guard world. | One consistent statement in LEARNINGS, citing run ids. |

## Status (2026-09-23)

| ID | State | Evidence |
| --- | --- | --- |
| A1 | **DONE** | Guard in #1196 (`319daa9`). Canary PR #1198 (branched off the guard, one labeled `packages/**` comment, closed unmerged) run `35912896951`: `Filter src = true`, `reader-core = true`, then `E2E Smoke Tests` job `107359758176` → `success`/15 steps and `Benchmark` job `107359758129` → `success`/11 steps. Control: workflow-only PR #1196 run `35911442657` → `Filter src = false`, both jobs `skipped`/`steps=0`, so the scope filter is intact. |
| A2 | **DONE — nothing to fix** | The lane is green on its first ever execution: `playwright install --with-deps chromium webkit` (ADR-201's per-PR WebKit lane ran for the first time), then Dev Smoke → Preview Smoke → Startup Performance → PWA smoke, all `success`. No findings, so no CI-only fix loop was needed. |
| A3 | **DONE** | `Benchmark` ran baseline → head → `node scripts/compare-benchmarks.mjs baseline.json head.json` in both `Compare benchmarks` and the blocking `Check for regression` step (ADR-218), plus `Post benchmark comment` — all `success` on an unchanged PR. |
| A4 | **DONE** | Sensor `Gate Visibility Sensor` in #1199 (`2e7735cf`), asserted on `[changes, build, e2e-smoke, bench]` with `always()`. Positive canary PR #1200 (run `35969509241`): `Filter src = true`, both gates `pass`, sensor `pass` on its applicable path — `smoke=success bench=success scope=true`. Negative canary PR #1201 (run `35969514199`): `e2e-smoke` force-skipped with `if: ${{ false }}`, `Benchmark` still `pass`, sensor `fail` (exit 1) — `::error::e2e-smoke was skipped although its scope filter matched (ADR-277, #1193)` with `smoke=skipped bench=success scope=true`. Both canaries closed unmerged; eight local scenarios (A–H) cover the truth table. Caveat: per LEARNINGS §263 the `main` ruleset requires only Codacy as a hard status check, so the sensor delivers visibility on every run but only blocks merges if it is added to the ruleset. |
| A5 | **DONE** | §502 corrected and reconciled with §261, plus a dated entry citing run ids — merged in #1194. |

## Exit criteria (plan done when)

- A1–A5 all met, and
- the next PR touching `src`/`reader-core` shows `E2E Smoke Tests` **success**
  and `Benchmark` **success** in `gh pr checks`, and
- A4's sensor (ADR-277) is live so a future regression to this state fails CI.

All three are met by this PR: A1–A5 per the Status table; the `src`-matching
PRs were the throwaway canaries #1198 and #1200 (both gates `success` there,
and `Benchmark` ran ADR-218's blocking comparator); the sensor lands here and
was proven red on #1201.

## Non-goals

- No change to what the smoke lane tests, to Playwright project selection, or
  to ADR-201's WebKit policy — only to whether the job runs at all.
- No relaxation of `QUALITY_GATE_NO_SMOKE=1` in the `quality-gate` job
  (#928/#944: that job has no Worker backend); CI smoke stays the dedicated
  job's responsibility.
