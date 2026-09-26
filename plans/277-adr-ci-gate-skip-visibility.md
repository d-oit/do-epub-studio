# ADR-277: A CI gate that can silently skip is not a gate

**Date:** 2026-09-23
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** GOAP-277, ADR-201, ADR-218, ADR-083, ADR-246, issue #1193

## Context

Two jobs in `.github/workflows/ci.yml` are the enforcement points for
previously accepted decisions:

- `e2e-smoke` — ADR-201, "so Safari/WebKit regressions are caught on every
  PR"; also the only PR-path coverage for Playwright smoke, because
  `quality-gate` deliberately runs with `QUALITY_GATE_NO_SMOKE=1` (no Worker
  backend in that job, #928/#944).
- `bench` — ADR-218, "Blocking per ADR-218: >20% ops/s regression on any
  benchmark fails the CI check".

Both are `skipped` in every run sampled on 2026-09-23 (seven runs, PR and
push) **while their scope filter evaluated true** — `dorny/paths-filter`
logged `src`/`reader-core` = `true`, `build`'s legs had already completed
`success`, and four seconds later both jobs recorded `steps: []`. The only
three jobs that `need: build` are these two and `performance-report`; the
third carries `always()` and is the only one that runs. Full evidence table in
GOAP-277.

A check that reports `skipped` is displayed nowhere near `failed`, is not
`failure()` for downstream jobs, and does not trip `notify-failure`. Nothing in
the repo asserts that a gating job ran, so two accepted ADRs have been
unenforced for as long as the sampled history goes back — with a green
check suite the whole time. Documentation compounded it: a LEARNINGS entry
told future agents that `e2e-smoke` covers PR smoke, which is false.

## Decision

1. **A gating job must be fail-closed against being skipped.** Any job whose
   absence weakens an accepted ADR carries an explicit guard on its `if`:
   `always() && !contains(needs.*.result, 'failure') &&
!contains(needs.*.result, 'cancelled')` ANDed with — never replacing —
   its existing scope/event condition. This is the pattern `build` already
   uses for the same cascade (GOAP-267). Scope filters stay: a guard must not
   turn a docs-only PR into a 20-minute Playwright run.
2. **Skip is a first-class CI outcome for gating jobs and must be visible.**
   `skipped` while the job's scope filter matched is a defect, reported like
   a failure (GOAP-277 A4 sensor), not an acceptable quiet state. Jobs
   conditioned on event type (`e2e-full` on cron, `lint`/`typecheck`/`test` on
   non-PR) are exempt: their skip is the designed behaviour.
3. **A coverage claim requires run evidence.** Any statement of the form
   "job X covers Y" in `agents-docs/LEARNINGS.md` or `plans/` must cite a run
   id in which X actually ran for Y. Claims inferred from workflow source are
   marked as unverified until then. This invalidates the LEARNINGS §502
   addendum and is applied by GOAP-277 A5.

## Consequences

- `e2e-smoke` and `bench` start running on matching PRs (GOAP-277 A1), which
  may surface long-hidden red: the smoke lane has not executed in the sampled
  history, and ADR-218's blocking benchmark comparison has never blocked
  anything. Enabling them is expected to cost CI minutes and possibly fixes —
  that cost is accepted rather than continuing to ship unenforced ADRs.
- Workflow edits to gating jobs must keep the guard shape; a reviewer asks for
  run evidence whenever a PR claims coverage.
- `notify-failure` gains real signal on `main` (it already `needs` these jobs).

## Alternatives rejected

- **Do nothing / document the skip.** Leaves two ADRs unenforced with a green
  suite; documentation already drifted into a false coverage claim once.
- **Delete the jobs.** Abandons ADR-201 and ADR-218 outright; that would need
  its own reversal ADR, and neither decision has been withdrawn.
- **Make `quality-gate` run smoke locally.** Blocked by #928/#944 (no Worker
  backend in that job) and by ADR-277-era containers being unable to install
  any browser at all.
