# GOAP-272: Keep atomic-commit from destroying work on inconclusive CI

**Status:** DONE (this PR)
**Date:** 2026-09-22

## Context

`scripts/atomic-commit/run.sh` treated every nonzero exit from `verify.sh` as
a check failure and ran the full rollback: close the PR, force-push the branch
back, reset the commit. `verify.sh` exited 1 for three distinct situations — a
real check failure, the polling deadline expiring with checks still pending,
and a PR whose checks never registered (plus any GitHub API outage along the
way). Two PRs (#1158, #1160) lost their review state that way: healthy
branches were rolled back because CI was merely slow or absent.

## Decision (policy)

`verify.sh` now reports three states, and only one may destroy work:

| Exit | Meaning | Orchestrator action |
|------|---------|---------------------|
| 0 | every check passed | proceed |
| 1 | at least one check failed | rollback (close PR, restore branch, reset commit) |
| 2 | inconclusive: deadline reached, no checks ever appeared, or GitHub unreachable | keep the PR and branch; the operator decides |

The mapping lives in `scripts/lib/verify-outcome.sh`
(`decide_verify_action`) so the destructive branch is test-covered rather
than only readable in `run.sh`, and unknown exit codes fail toward "keep",
never rollback. Hardening in the same change: every `gh` call in the poll
loop gets a per-call timeout (`ATOMIC_COMMIT_GH_TIMEOUT`, default 60s) so a
hung API call reads as "no data this round" instead of a stalled gate, and a
wall-clock jump (WSL suspend/resume, NTP step) is surfaced as a warning
instead of silently inflating the elapsed-time budget.

## Phases

| # | Phase | Exit criteria | Status |
|---|-------|---------------|--------|
| 1 | Outcome split: verify exit codes, `decide_verify_action`, orchestrator branching | bats covers pass, fail, both inconclusive paths, and the mapping including unknown codes; only exit 1 reaches the rollback branch | DONE (this PR: `scripts/tests/atomic-commit-verify.bats`, 5 specs green) |
| 2 | Poll-loop hardening: per-call `gh` timeout, clock-jump warning, fail-branch timeout | stubbed-`gh` bats tests pass with no real network; `shellcheck --severity=error` clean on all touched scripts | DONE (this PR) |

## Related

- PRs #1158 and #1160 — lost to the pre-split rollback behavior; this plan is
  their follow-up.
- GOAP-270 — established the bats stub-layering approach reused here (stub
  the network edge, not the unit under test).
