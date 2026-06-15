# GOAP Plan 084 — CHANGELOG and CONTRIBUTING sync

**Date:** 2026-06-15
**Orchestrator:** goap-agent
**Source:** `analysis/SWARM_ANALYSIS.md` G27
**Closes:** G27 (CHANGELOG.md and CONTRIBUTING.md are stale)

## 1. Analysis

- **Primary Goal:** `CHANGELOG.md` lists the merges of plan 093
  (PR #525, in-book search) and plan 094 (PR #527, plan-092
  resolution); `CONTRIBUTING.md` coverage thresholds match
  `AGENTS.md` exactly and add the missing `schema`, `testkit`,
  `ui` packages.
- **Constraints:** Documentation only; no code changes.
- **Complexity:** Trivial.

## 2. Decomposition

1. **CHANGELOG.md:** add `[Unreleased]` bullets for:
   - **Added** — in-book search side-panel (PR #525).
   - **Changed** — session-expiry handling, signed-URL
     metadata, security posture docs (PR #527).
   - **Documentation** — `docs/security-posture.md`,
     `docs/observability-telemetry.md` brought current.
2. **CONTRIBUTING.md:** replace lines 42-46 with the
   authoritative copy from `AGENTS.md`:
   ```
   - web: 55% Lines, 48% Functions
   - worker: 55% Lines, 50% Functions
   - shared: 40% Lines, 50% Functions
   - reader-core: 72% Lines, 70% Functions
   - schema: 15% Lines, 5% Functions
   - testkit: 25% Lines, 20% Functions
   - ui: 10% Lines, 5% Functions
   ```
3. **Verification:** add a `scripts/check-contributing-thresholds.mjs`
   that asserts `CONTRIBUTING.md` matches `AGENTS.md` line for
   line. (Out of scope for this PR; tracked as a follow-up.)

## 3. Strategy

**Sequential, one PR.**

## 4. Quality Gates

- Markdownlint (`pnpm exec markdownlint CHANGELOG.md CONTRIBUTING.md`)
- `./scripts/quality_gate.sh`

## 5. Atomic Commits

1. `docs(changelog): record plan 093 + 094 merges`
2. `docs(contributing): align coverage thresholds with AGENTS.md`
3. `docs(plans): record execution of plan 084`

## 6. Reference

- `analysis/SWARM_ANALYSIS.md` G27
- `AGENTS.md` TIER-2 (canonical thresholds)
- PRs #525, #527 (recent merges to record)
