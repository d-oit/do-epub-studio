# GOAP Plan 055: Remaining Tasks Implementation Swarm

**Date:** 2026-05-26
**Status:** ✅ Closed — PR #367 merged to main at a88f9ae
**Strategy:** Hybrid — parallel swarm for independent tasks
**Related:** Plans 035, 036, 038, 044, 050, 053

## Goal

Implement all remaining missing tasks identified across plans/ analysis.

## Remaining Tasks

| ID | Priority | Task | Skill | Files |
|---|----------|------|-------|-------|
| T1 | P0 | Raise coverage thresholds for shared and web | `code-quality` | `packages/shared/vitest.config.ts`, `apps/web/vitest.config.ts` |
| T2 | P1 | Add pre-commit hooks execution to CI workflow | `cicd-pipeline` | `.github/workflows/ci.yml` |
| T3 | P1 | Add WebKit and mobile viewport to Playwright config | `test-runner` / `testing-strategy` | `playwright.config.ts` |
| T4 | P1 | Add traceId assertion tests for Worker API | `testing-strategy` | `apps/tests/` |
| T5 | P1 | Finalize CSP ADR from Proposed→Accepted | `security-code-auditor` | `plans/035-adr-content-security-policy.md` |
| T6 | P1 | Update CI composite actions for Node.js 24 compatibility | `cicd-pipeline` | `.github/actions/` |
| T7 | P2 | Plan 007 Phase 8 pointer / plan status sync | `agents-md` | `plans/` |

## Strategy

**Sequential:** T1 → T2/T3/T4/T5/T6 (parallel swarm) → T7

## Execution Summary

| ID | Priority | Task | Skill | Status |
|---|----------|------|-------|--------|
| T1 | P0 | Raise coverage thresholds for shared and web | `code-quality` | ✅ Merged — shared: 25→40(L),30→50(F),20→35(B),25→35(S); web: 50→55(L),40→48(F),29→40(B),35→55(S) |
| T2 | P1 | Add pre-commit hooks execution to CI workflow | `cicd-pipeline` | ✅ Already existed in CI workflow (lines 97-112) |
| T3 | P1 | Add WebKit and mobile viewport to Playwright config | `test-runner` | ✅ Already configured — WebKit conditionally enabled, iPhone/Pixel projects present |
| T4 | P1 | Add traceId assertion tests for Worker API | `testing-strategy` | ✅ Already implemented — `apps/tests/traceid-header.spec.ts` |
| T5 | P1 | Finalize CSP ADR from Proposed→Accepted | `security-code-auditor` | ✅ Merged — status updated in `plans/035-adr-content-security-policy.md` |
| T6 | P1 | Update CI for Node.js 24 compatibility | `cicd-pipeline` | ✅ Already set — `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` in CI workflow |
| T7 | P2 | Plan status sync across all plans | `agents-md` | ✅ Updated 3 plan files, created 1 new plan |

## Post-Merge Validation

- ✅ All 14 CI jobs passed (Setup, Dep Scan, CodeQL Check, Pre-commit, Lint, Typecheck, Unit Tests, Build, E2E Smoke, Benchmark, Performance Report, CodeQL, Lighthouse, Cloudflare Pages)
- ✅ Codacy: 0 issues
- ✅ Main branch CI: success
- ✅ Branch auto-deleted after merge

## Quality Gates

- ✅ `./scripts/minimal_quality_gate.sh` — Passed
- ✅ `./scripts/quality_gate.sh` — Passed
- ✅ All GitHub Actions checks passed on PR
- ✅ Coverage validation for T1 — Shared: 42.85% L, 75% F, 46.66% B, 41.48% S; Web: 57.37% L, 49.59% F, 42.51% B, 56.72% S
