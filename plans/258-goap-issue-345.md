# GOAP-345 — CI Failure on Main (Run 26446431433)

Issue: [#345](https://github.com/d-oit/do-epub-studio/issues/345) — CLOSED 2026-05-26 (COMPLETED)
Status: **Verified closed; no action required this sprint** (issue pre-dated this sprint's start).

## Goal

Restore the CI pipeline on main after run 26446431433 failed on commit `b998b3b5`.

## ADR

- **Chosen (as implemented historically)**: root-cause fix merged the same day the issue closed (opened ~10:20Z, closed 11:49Z 2026-05-26); pipeline returned to green and has stayed green into 2026-08-29 (CI + CodeQL + Scorecard runs on current HEAD `c2c54d77` conclude `success`; recent `cancelled` rows are concurrency-superseded re-runs, not failures).
- **Rejected**: retry/skip flake band-aid — violates AGENTS.md test guardrails (fix determinism, never skip).

## Acceptance → Evidence

| Acceptance | Evidence (grounded 2026-08-29) |
|---|---|
| CI green on main | `gh run list`: CI/CodeQL/Scorecard `success` on `c2c54d77`; historical failing run `26446431433` (conclusion `failure`, 2026-05-26T10:20:23Z) predates the fix commit merged before 11:49Z |
| No skips/retries added | Current workflow set (`.github/workflows/`) contains no skip markers for the affected job |

## Effort

S (historical; verification only this sprint).
