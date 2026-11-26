# GOAP-315: Land the studio workflow modernization with all CI green

**Status:** DONE (2026-11-26) — merged via PR #1522 (squash `44e98461`); all required checks green.
**Date:** 2026-11-19 (rebased 2026-11-26)
**Related:** issue #1014, GOAP-314, GOAP-1433, PR #1481 (closed unmerged), ADR-1022

## Goal

Deliver the staged `feat/studio-workflow-modernization` changeset (modernized
author preview, export pipeline, gates) as a **merged PR whose every required
CI check passes**, while advancing the open plans that are actionable without
operator credentials.

## Analysis (session start, 2026-11-19)

- The branch sits at main's tip (`af09c776`) with the closed PR #1481's commit
  (`7cfa4865`) restored into the index: 317 files, tree-identical to that
  commit. The prior session closed the PR unmerged after two CI failures.
- **CI failure 1 — Fast Check (Changed Packages):** two failing tests in
  `scripts/__tests__/validate-gate-parity.test.mjs`
  ("resolves explicitly declared external app checks (Codacy)";
  "expands matrix job names to real per-node check contexts"), both
  `AssertionError: expected 1 to be +0` — the new
  `scripts/validate-gate-parity.mjs` gate exits non-zero on manifests where it
  must succeed.
- **CI failure 2 — Full Quality Gate:** `✗ bats not installed — shell tests
cannot run (required phase)` → exit 2; the gate declares bats a required
  phase but the workflow never installs bats.
- Open GitHub issues: #1014 only (operator-credential live acceptance; the
  in-repo CI smoke check already exists per ADR-1022).
- Open plan tasks: GOAP-1433 peer-warnings acceptance (blocked on upstream as
  of 2026-11-18 — recheck today); GOAP-1017 checks all ticked.

## Work packages

1. **WP1 — Tool fix — DONE (2026-11-26):** the two failures were the test
   fixture's empty `local.checks`/`release.checks`/`requiredSteps` defaults;
   the fail-closed validator rejected them. Fixture defaults now describe a
   complete manifest, and all 17 tests pass without weakening assertions.
2. **WP2 — CI fix — DONE on `main`:** `e251138d` already installs pinned
   `bats@1.13.0` before the gate; the rebase keeps main's step.
3. **WP3 — Verification — DONE (2026-11-26):** rebase onto `d76f89c5`
   resolved 12 conflicts; full `./scripts/quality_gate.sh` passed, and the
   targeted reader/worker/runner suites pass.
4. **WP4 — Plan upkeep — DONE:** ADR-INDEX row added; GOAP-1433 remains
   blocked upstream.
5. **WP5 — Delivery — DONE:** PR #1522 merged with the required checks
   green (squash `44e98461`).

## Session 2026-11-26 — rebase record

- Base moved from `af09c776` to `d76f89c5`; the branch commit contains the
  PR #1481 tree plus these merge repairs: shared archive-validator `limits`
  shape in `annotation-export-archive.ts`, `isValidCfi` import from
  `cfi-validation` in `multilingual-conformance.test.ts`, and restored
  `output`/`outputBytes` accumulators in the EPUBcheck runner.
- The 10 unstaged files left in the worktree were stale duplicates of #1482
  work already merged on main; they were backed up and discarded. The backup
  also held the WP1 fixture fix, which was reapplied before committing.
- `pnpm install` was required after the lockfile rebase: a lockfile-only
  install left `packages/testkit` without its `fflate` link.
- Independent security review (PR #1522) found three merge regressions, all
  fixed before re-push: undeclared `opf`/`epubVersion` in the runner (the
  success path always 503'd), an inverted Lighthouse fail-closed branch in
  `release.yml`, and a mixed-case appendix collision lookup. The runner now
  has a 200-path integration test that parses the response against
  `EpubRunnerResultSchema`.

## Quality gates

- `./scripts/quality_gate.sh` (fail-closed) before commit.
- CI: Fast Check, Full Quality Gate, all required PR checks must pass.
