# 010 – Optimization, Test, and Workflow Backlog (2026)

**Status:** Active  
**Created:** 2026-04-15  
**Depends on:** `plans/007-implementation-phases.md`, `plans/009-e2e-test-plan.md`, `docs/coding-guide.md`

## Objective

Track high-impact missing work discovered during the cross-cutting review of optimization, new feature readiness, docs quality, agent workflow hygiene, and verification tooling.

## Priority Backlog

| Priority | Track          | Missing task                                                                                        | Acceptance criteria                                                                                              |
| -------- | -------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| P0       | Testing        | Add focused component tests for `AnnotationToolbar`, `CommentInput`, `CommentsPanel`                | Coverage for these components reaches >=70% statements and core annotation create/delete/edit flows are asserted |
| P0       | Testing        | Add admin page unit/integration tests (`AdminLoginPage`, `BooksPage`, `GrantsPage`, `AuditLogPage`) | Each page has a happy path + one failure path test; regression suite passes in CI                                |
| P0       | E2E            | Implement smoke-tagged Playwright suite for PR validation                                           | `pnpm test:e2e --grep @smoke` completes in <=6 minutes on CI                                                     |
| P1       | Benchmarking   | Add Vitest benchmark suite for locator/re-anchor and annotation serialization                       | Benchmark command records baseline ops/sec and fails on >20% regression                                          |
| P1       | Performance    | Add Lighthouse CI budgets for reader first render and admin shell                                   | LCP, TTI, and JS payload budget checks run on main branch                                                        |
| P1       | Docs           | Refresh `plans/009-e2e-test-plan.md` from broad catalog to executable test matrix with ownership    | Every active E2E scenario maps to an actual spec file + owner                                                    |
| P2       | Agent workflow | Add monthly agent workflow checklist audit and stale-plan check                                     | `plans/007` and backlog plans include last-reviewed date and next review target                                  |
| P2       | DX             | Add `pnpm verify:fast` (lint + typecheck + targeted tests) for local pre-push loops                 | Command documented and runs in <3 minutes on a warm cache                                                        |

## Proposed Execution Order

1. Close P0 coverage gaps (annotation + admin tests).
2. Add smoke E2E tags and CI job path.
3. Introduce benchmark harness with regression threshold.
4. Add performance budgets + docs ownership mapping.
5. Automate monthly workflow audit in planning docs.

## Risks and Mitigations

- **Risk:** WebKit dependency failures on Linux runners create noisy red builds.  
  **Mitigation:** Keep WebKit opt-in via `PLAYWRIGHT_INCLUDE_WEBKIT=1` until runner images include required system libraries.
- **Risk:** Broad E2E matrix inflates CI time.  
  **Mitigation:** enforce smoke subset on PR, full matrix nightly.
- **Risk:** Benchmark variance causes flaky failures.  
  **Mitigation:** run benchmarks in dedicated CI job with warmup/repeat config and percent-regression thresholds.

## Definition of Done for this plan

- All P0 items merged.
- At least one benchmark baseline committed and tracked.
- E2E plan references executable tests rather than aspirational-only cases.
- Review date is updated in `plans/007-implementation-phases.md`.
