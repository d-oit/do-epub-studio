# GOAP Plan 061: CI Workflow Standardization, Coverage Configs, Doc References

**Date:** 2026-05-27
**Status:** ✅ Completed — PR #386 merged to main at df583f6
**Strategy:** Swarm — 4 parallel work packages
**Related:** Plans 026, 040, 044, 059, 060

## Goal

Close all remaining actionable items identified across plans/: standardize CI workflows with run-name, concurrency, timeout-minutes, and FORCE_JAVASCRIPT_ACTIONS_TO_NODE24; add missing coverage thresholds to ui package; sync AGENTS.md coverage thresholds with actual configs; fix broken documentation references.

## Tasks

| ID | Priority | Task | Skill | Status |
|----|----------|------|-------|--------|
| T1 | P0 | Add coverage thresholds + reportsDirectory to `packages/ui/vitest.config.ts` | `testing-strategy` | ✅ Done |
| T2 | P0 | Sync AGENTS.md coverage thresholds with actual configs (add schema/testkit/ui, fix reader-core 75→72, web 40→55, shared 25→40) | `code-quality` | ✅ Done |
| T3 | P0 | Add run-name, concurrency, timeout-minutes, FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 to scorecard.yml | `cicd-pipeline` | ✅ Done |
| T4 | P0 | Add run-name, timeout-minutes, FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 to dependabot-auto-merge.yml | `cicd-pipeline` | ✅ Done |
| T5 | P0 | Add run-name, timeout-minutes, FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 to stale-cleanup.yml | `cicd-pipeline` | ✅ Done |
| T6 | P0 | Add timeout-minutes, FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 to smart-update-pr.yml | `cicd-pipeline` | ✅ Done |
| T7 | P1 | Add run-name to lighthouse.yml | `cicd-pipeline` | ✅ Done |
| T8 | P1 | Add run-name to visual-regression.yml | `cicd-pipeline` | ✅ Done |
| T9 | P1 | Fix TODO(#163) count (~60→~4) and broken plan reference in eslint.config.js | `code-quality` | ✅ Done |
| T10 | P1 | Fix broken plan references in AGENTS.md (001, 002, 007, 002-006 → archive/) | `agents-md` | ✅ Done |

## Strategy

**Swarm parallel execution:**
- **WP1** (T1-T2): Coverage configs — `testing-strategy` agent
- **WP2** (T3-T6): CI workflow standardization — `cicd-pipeline` agent
- **WP3** (T7-T8): Workflow naming — `cicd-pipeline` agent
- **WP4** (T9-T10): Documentation fixes — `code-quality` + `agents-md` agents

All WPs independent → launched in parallel then aggregate.

## Execution Summary

| ID | Task | Status |
|----|------|--------|
| T1 | UI coverage: added thresholds {lines:10, functions:5, branches:5, statements:10} + reportsDirectory | ✅ Done |
| T2 | AGENTS.md: updated web (40→55%), shared (25→40%), reader-core (75→72%); added schema/testkit/ui | ✅ Done |
| T3 | scorecard.yml: +run-name, +concurrency, +timeout-minutes:15, +FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 | ✅ Done |
| T4 | dependabot-auto-merge.yml: +run-name, +timeout-minutes:10, +FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 | ✅ Done |
| T5 | stale-cleanup.yml: +run-name, +timeout-minutes:15 on both jobs, +FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 | ✅ Done |
| T6 | smart-update-pr.yml: +timeout-minutes:15, +FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 | ✅ Done |
| T7 | lighthouse.yml: +run-name | ✅ Done |
| T8 | visual-regression.yml: +run-name | ✅ Done |
| T9 | eslint.config.js: ~60→~4 remaining; plans/010 → plans/archive/010 | ✅ Done |
| T10 | AGENTS.md: 4 plan references fixed to archive/ path | ✅ Done |

## Files Changed

| File | Change |
|------|--------|
| `packages/ui/vitest.config.ts` | Added `reportsDirectory: './coverage'` + `thresholds: { lines: 10, functions: 5, branches: 5, statements: 10 }` |
| `.github/workflows/scorecard.yml` | Added run-name, concurrency group, timeout-minutes:15, FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 |
| `.github/workflows/dependabot-auto-merge.yml` | Added run-name, FORCE_JAVASCRIPT_ACTIONS_TO_NODE24, timeout-minutes:10 |
| `.github/workflows/stale-cleanup.yml` | Added run-name, FORCE_JAVASCRIPT_ACTIONS_TO_NODE24, timeout-minutes:15 on both jobs |
| `.github/workflows/smart-update-pr.yml` | Added FORCE_JAVASCRIPT_ACTIONS_TO_NODE24, timeout-minutes:15 |
| `.github/workflows/lighthouse.yml` | Added run-name |
| `.github/workflows/visual-regression.yml` | Added run-name |
| `AGENTS.md` | Updated coverage thresholds (web, shared, reader-core; added schema/testkit/ui); fixed 4 plan references to archive/ |
| `eslint.config.js` | Fixed TODO(#163) count (60→4); fixed plan reference (010→archive/) |

## Quality Gates

- [x] `./scripts/minimal_quality_gate.sh` — Passed (lint, typecheck, shellcheck)
- [x] `./scripts/validate-workflows.sh` — Passed (all 9 workflows, actionlint + zizmor)
- [x] `pnpm lint` — Passed (0 errors, pre-existing warnings only)
- [x] `pnpm typecheck` — Passed (7/7 packages)
- [x] `pnpm test:coverage` — Passed
- [x] `pnpm build` — Passed
- [⚠] `pnpm test:e2e:smoke` — Failed locally (port conflict — pre-existing environment issue; passes in CI)
- [x] GitHub Actions CI — ✅ All 15 jobs passed on PR #386
- [x] Main CI after merge — ✅ Merged at df583f6
- [x] Branch auto-deleted after merge
