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

## Phase 5 — Synthesis (COMPLETE)

### Merged (non-auth, CI green incl. Codacy)

| PR | What | Result |
|----|------|--------|
| #992 | github-actions bump (codeql 4.37.7) | allowlist fix → green → merged |
| #998 | @sentry/react bump | merged |
| #997 | @sentry/cloudflare bump | rebased (lockfile) → merged |
| #996 | production-deps bump (2) | merged |
| #995 | dev-deps bump (17) | rebased (lockfile) → merged |
| #999 | fix #994: harden 2 flaky E2E + CI failure auto-close | merged |
| #1000 | learnings doc (Dependabot force-push + Chromatic actor) | merged |
| #1002 | de-flake ConflictResolutionPanel seed timestamp | merged |
| #1004 | retry actionlint download (fix #1003) | merged |

### Issues resolved

- **#994** — fixed by #999 (flaky webkit performance + settings-panel overflow; plus `close-failure-issues` now gates on `e2e-full` and no longer depends on skipped `build`).
- **#1001** — fixed by #1002 (`seedConflict()` called `Date.now()` twice; ms tick yielded unequal timestamps → `detectConflict` returned null → empty panel).
- **#1003** — fixed by #1004 (transient actionlint release-download blip; `curl | tar || true` swallowed the error → hard-fail "actionlint not available"; now retries 3x).

### Remaining (left for human — user chose "non-auth only")

- **#991** demo login + help (GOAP-244) — now **CLEAN** (stale OwlWatch thread resolved); needs human review before merge.
- **#993** login UX redesign — stacked on #991; blocked only on Chromatic baseline acceptance (human click).

### Pre-existing issues fixed in-scope

1. `close-failure-issues` job `skipped` on scheduled runs (depended on PR-only `build`; didn't gate on `e2e-full`) → fixed in #999.
2. `clickToolbarButton` fell through to `dispatchEvent` on a hidden settings button on narrow viewports → hardened in #999.
3. `seedConflict()` double-`Date.now()` race → fixed in #1002.
4. `validate-workflows.sh` actionlint download swallowed errors → retry added in #1004.

**Final state:** 0 open issues, 0 open non-auth PRs; `main` green. Only the two auth PRs (#991, #993) remain, both requiring human review per scope decision.
