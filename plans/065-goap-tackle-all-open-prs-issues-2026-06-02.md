# GOAP Plan: Tackle All Open PRs and Issues

**Date**: 2026-06-02
**Orchestrator**: goap-agent
**Objective**: Systematically resolve all open PRs and issues to achieve a clean, high-performance, and fully compliant codebase.

## 1. Analysis
- **Primary Goal**: Close all open PRs and issues with high-quality, tested code.
- **Constraints**: Must pass all quality gates (`./scripts/quality_gate.sh`), use atomic commits, and adhere to AGENTS.md rules.
- **Complexity**: Complex (spans CI/CD, performance, reader UI, worker runtime, and observability).

## 2. Decomposition & Batching
Tasks are grouped by domain to enable focused, parallel, or sequential execution.

### Batch 1: CI/CD Dependabot Updates (P0)
- **PRs**: #413, #412, #411, #410, #409, #408, #407
- **Action**: Validate and merge Dependabot PRs for GitHub Actions. Use `github-actions-version-fix` skill to verify SHAs/tags.
- **Quality Gate**: `./scripts/validate-workflows.sh` must pass.

### Batch 2: Dev Environment Fixes (P0)
- **PR**: #402 (fix: resolve warnings from pnpm run dev)
- **Action**: Identify and resolve all warnings during `pnpm run dev`.
- **Quality Gate**: `pnpm run dev` starts with zero warnings.

### Batch 3: Build & Monorepo Performance (P1)
- **PR/Issue**: #406/#399 (perf(turbo): tighten inputs/outputs), #398 (perf(build): route-aware bundle budgets)
- **Action**: Optimize `turbo.json` cache keys and implement Vite bundle budgets.
- **Quality Gate**: Turborepo cache hit rate improves; build size constraints enforced.

### Batch 4: Reader Performance (P1)
- **PR/Issue**: #415/#397 (perf(reader): virtualize TOC + annotation lists, parallelize EPUB load, reduce boot cost)
- **Action**: Implement virtualization for large lists, parallelize EPUB parsing, and optimize initial render.
- **Quality Gate**: Reader boot cost and chapter-switch latency measurably reduced; tests pass.

### Batch 5: Cloudflare Worker 2026 Best Practices (P1)
- **PR/Issue**: #403/#400 (Align Cloudflare Worker with 2026 Best Practices)
- **Action**: Update Worker runtime, request paths, and D1/R2 interactions to match 2026 standards.
- **Quality Gate**: Worker tests pass; no regressions in API endpoints.

### Batch 6: Observability Baseline (P2)
- **Issue**: #401 (observability(perf): connect Lighthouse, bundle budgets, and runtime metrics)
- **Action**: Integrate Lighthouse CI, configure bundle budget warnings, and add runtime performance metrics.
- **Quality Gate**: Metrics are visible in CI and runtime dashboards.

## 3. Strategy
- **Hybrid Execution**:
  - Batch 1 can be executed in parallel (independent Dependabot PRs).
  - Batches 2-6 will be executed sequentially to ensure stability and allow for focused testing.
- **Quality Gates**: Run `./scripts/quality_gate.sh` and `./scripts/validate-workflows.sh` after every batch.
- **Atomic Commits**: Every logical change will be committed using `./scripts/atomic-commit/run.sh`.

## 4. Agent Assignment
- **goap-agent**: Overall orchestration and synthesis.
- **github-actions-version-fix**: Batch 1 validation.
- **cloudflare-worker-api**: Batch 5 implementation.
- **reader-ui-ux**: Batch 4 implementation.
- **cicd-pipeline**: Batch 3 & 6 implementation.

## 5. Execution Plan
1. Create ADR for this initiative.
2. Execute Batch 1 (Dependabot).
3. Execute Batch 2 (Dev warnings).
4. Execute Batch 3 (Turbo/Build).
5. Execute Batch 4 (Reader Perf).
6. Execute Batch 5 (Worker Best Practices).
7. Execute Batch 6 (Observability).
8. Final quality gate and synthesis.

## 6. Synthesis
- [ ] All PRs merged or closed with reference to this plan.
- [ ] All issues closed.
- [ ] Quality gates passing.
- [ ] No regressions introduced.
