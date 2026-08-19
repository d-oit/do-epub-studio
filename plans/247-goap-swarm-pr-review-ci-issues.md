# GOAP-247: Open PR Review, CI Remediation, and Issue Implementation

**Status:** IN PROGRESS
**Date:** 2026-08-19
**Strategy:** Hybrid (parallel triage → sequential fixes → swarm review)

## Phase 1 — Analysis (COMPLETE)

Seven open PRs and one open issue were triaged:

| PR | Title | CI | State | Action |
|----|-------|----|-------|--------|
| #998 | bump @sentry/react 10.69.0→10.70.0 | all green | CLEAN | merge (dependency, low risk) |
| #997 | bump @sentry/cloudflare 10.69.0→10.70.0 | all green | CLEAN | merge (dependency, low risk) |
| #996 | bump production-dependencies group (2) | all green | CLEAN | merge (dependency, low risk) |
| #995 | bump dev-dependencies group (17) | all green | CLEAN | merge (dependency, low risk) |
| #993 | login UX redesign (password toggle + autofill) | green except Chromatic "UI Tests pending" | UNSTABLE | fix-able only by human (baseline acceptance); stacked on #991 |
| #992 | bump github-actions group (codeql 4.37.7) | Full Quality Gate + Pre-commit FAIL | UNSTABLE | **fix: add codeql-action v4.37.7 SHA to allowlist** |
| #991 | demo login + help entry points (GOAP-244) | all green | BLOCKED | **fix: resolve stale OwlWatch review thread** |
| issue #994 | CI failure on main (scheduled cross-browser E2E) | 2 E2E tests fail | open | **fix: diagnose + repair 2 failing E2E tests** |

## Phase 2 — Decomposition

- **P0** Fix #992: codeql-action 4.37.7 SHA `ff2f1c621b7f889edc0d3c761ac2e6a3f8cdb0dd` not in `scripts/validate-shas.sh` allowlist.
- **P0** Fix #991: resolve the stale OwlWatch review thread (finding already addressed in code, `isOutdated: true`).
- **P0** Issue #994: two scheduled-lane E2E failures (webkit `performance.spec` ErrorBoundary crash; iphone `login-and-book-load` settings-panel overflow).
- **P1** Merge green dependabot PRs #995–#998 (non-auth, low-risk).
- **P1** #993: only remaining blocker is Chromatic baseline acceptance (human-in-the-loop).

## Phase 3 — Execution

Sequential: #992 allowlist → #991 thread → #994 E2E → merge dependabot → synthesis.
See execution record for commits.

## Phase 4 — Constraints / Human-in-the-loop

- #993 "UI Tests (Chromatic)" requires a human to accept 70 baselines.
- Auth-touching PRs (#991, #993) require human review per repo policy.
- No `gh pr merge --auto`; manual squash merge only after full checklist.
