# GOAP Plan 075: Close Open Issues Addressed by Merged Work

**Date**: 2026-06-11
**Orchestrator**: goap-agent

## 1. Analysis (World State)

### Open Issues Still on Board

| # | Title | Addressed By | Evidence |
|---|-------|-------------|----------|
| 473 | CI failure on main: 27321424995 | Plan 074 (pending fix) | E2E failures, needs code fix |
| 452 | docs(ai): add llms.txt and llms-full.txt | PR #458 (merged via bf01bc0) | Files exist in repo |
| 451 | dx: add commitlint.config.cjs | PR #458 (merged via bf01bc0) | File exists at `commitlint.config.cjs` |
| 449 | dx: add PR_VERIFICATION_CHECKLIST.md and GUIDE.md | PR #458 (merged via bf01bc0) | Files exist in `.github/` |
| 448 | dx: extend PULL_REQUEST_TEMPLATE.md | PR #458 (merged via bf01bc0) | File is 142+ lines in `.github/` |
| 447 | security: add .gitleaks.toml | PR #458 (merged via bf01bc0) | File exists at `.gitleaks.toml` |
| 446 | fix(dx): extend .pre-commit-config.yaml | PR #458 (merged via bf01bc0) | File exists with gitleaks+yamllint hooks |
| 445 | perf: keep agent files thin + AGENTS.md guards | PR #458 (merged via bf01bc0) | `scripts/check-agent-sync.mjs` exists |
| 442 | perf: add path-based CI job filters | PR #458 (merged via bf01bc0) | `dorny/paths-filter` in ci.yml |

### Merged PRs Addressing These Issues

- **PR #458** "dx: scaffold agent infrastructure, CI hardening, and Turbo tuning" — merged as commit `bf01bc0` on main. This PR explicitly addresses issues #442–#454 per its body and plan 068.
- **PR #472** "fix(ci): add Dependabot action SHAs and ignore __stories__ dirs" — merged as commit `d5afad1`.

### Issues That Can Be Closed Immediately

Issues #442, #445, #446, #447, #448, #449, #451, #452 are all fully implemented on main.
Their corresponding files/features are verified present in the current codebase.

### Issue That Requires Further Work

- **#473** — CI E2E failure. Requires the code fixes documented in plan 074.

## 2. Goal State

- All issues addressed by merged PRs are closed with a reference to the implementing commit.
- Issue #473 remains open until plan 074 fixes are merged.

## 3. Actions

| ID | Action | Command |
|----|--------|---------|
| 1 | Close #442 | `gh issue close 442 --comment "Implemented in bf01bc0 (PR #458) — dorny/paths-filter added to CI"` |
| 2 | Close #445 | `gh issue close 445 --comment "Implemented in bf01bc0 (PR #458) — check-agent-sync.mjs + size guards"` |
| 3 | Close #446 | `gh issue close 446 --comment "Implemented in bf01bc0 (PR #458) — gitleaks + yamllint hooks added"` |
| 4 | Close #447 | `gh issue close 447 --comment "Implemented in bf01bc0 (PR #458) — .gitleaks.toml added"` |
| 5 | Close #448 | `gh issue close 448 --comment "Implemented in bf01bc0 (PR #458) — PR template extended"` |
| 6 | Close #449 | `gh issue close 449 --comment "Implemented in bf01bc0 (PR #458) — checklist + guide added"` |
| 7 | Close #451 | `gh issue close 451 --comment "Implemented in bf01bc0 (PR #458) — commitlint.config.cjs added"` |
| 8 | Close #452 | `gh issue close 452 --comment "Implemented in bf01bc0 (PR #458) — llms.txt + llms-full.txt added"` |
| 9 | Keep #473 open | Tracked by plan 074 |

## 4. Execution Status

- [ ] Batch-close issues #442, #445–#449, #451–#452
- [ ] Verify each closed issue references the implementing commit
- [ ] Confirm #473 tracked by plan 074
