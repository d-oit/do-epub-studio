# GOAP Plan 062: Final Remaining Tasks Closeout

**Date:** 2026-05-27
**Status:** In Progress
**Strategy:** Swarm — 5 parallel work packages + sequential PR cycle
**Related:** Plans 048, 050, 060, 061

## Goal

Close all remaining actionable items across the codebase:
- Fix Node.js version mismatch in CI setup action
- Fix 18 non-null assertion violations and promote ESLint rule to error
- Sync Lighthouse documentation with actual config thresholds
- Update stale plan statuses (045, 050, 026-028, 036, 037, 049 archived)

## Tasks

| ID | Priority | Task | Skill | Status |
|----|----------|------|-------|--------|
| T1 | P0 | Fix Node.js 22→24 in `.github/actions/setup-pnpm/action.yml` | `cicd-pipeline` | Pending |
| T2 | P0 | Fix 18 `no-non-null-assertion` violations in `locator-cfi.test.ts` | `code-quality` | Pending |
| T3 | P0 | Promote `no-non-null-assertion` ESLint rule from 'warn'→'error' | `code-quality` | Pending |
| T4 | P1 | Sync `docs/lighthouse.md` thresholds with `.lighthouserc.json` | `agents-md` | Pending |
| T5 | P1 | Update plan statuses (045, 050, 026-028, 036, 037) with completion status | `agents-md` | Pending |
| T6 | P1 | Fix archived plan 049 status from "pending" to "archived/superseded" | `agents-md` | Pending |
| T7 | P0 | Quality gate, commit, feature branch, push, PR | `github-workflow` | Pending |
| T8 | P0 | Address PR comments, merge to main | `github-pr-autopilot` | Pending |
| T9 | P1 | Update plan 062 status, compact learnings | `learn` | Pending |

## Strategy

**Parallel swarm (T1-T6):** All independent code/doc changes
**Sequential:** T7 (PR) → T8 (merge) → T9 (cleanup)

## Quality Gates

- [ ] `./scripts/minimal_quality_gate.sh` — lint, typecheck, shellcheck
- [ ] `pnpm lint` — 0 errors, 0 warnings
- [ ] `pnpm typecheck` — 7/7 packages
- [ ] `pnpm build` — Passed
- [ ] `./scripts/validate-workflows.sh` — All workflows valid
- [ ] GitHub Actions CI — All jobs pass
