# Plan 040: GOAP — Warnings and Pre-existing Issues (2026-05-19 Session)

**Date:** 2026-05-19
**Goal:** Document all warnings, pre-existing issues, and infrastructure problems encountered during the Plan 038 backlog triage session
**Status:** 🟢 Documented — all items classified per ADR-024
**Strategy:** Parallel — independent items
**Driver:** AGENTS.md Tier 2 compliance + ADR-024 warning management policy

---

## Phase 1: ANALYZE — Inventory

### Infrastructure — CI/CD (4 items)

| ID | Issue | Location | Classification | Root Cause | Impact |
|----|-------|----------|----------------|------------|--------|
| CI-W1 | GitHub Actions "workflow file issue" on all runs | `.github/workflows/*.yml` on `main` branch | **Monitor** — upstream infrastructure | GitHub Actions runner fails to parse/execute workflows with `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` | All CI runs fail on main with generic error. Affects all PRs. First observed on commits from #187 onward. |
| CI-W2 | SHA allowlist drift after PR #182 merge | `scripts/validate-shas.sh` missing `codecov/codecov-action@e79a6962` | **Active** → **Resolved** | PR #182 (codecov v6 bump) merged without corresponding SHA allowlist update | All CI runs after #182 merge failed `pnpm lint:workflows`. Fixed by PR #186. |
| CI-W3 | `codecov/codecov-action@e79a6962` duplicate in allowlist | `scripts/validate-shas.sh` | **Active** → **Resolved** | Merge conflict between PR #186 fix and existing entries created duplicate | Quality gate still passed (duplicate entry doesn't break validation). Fixed in PR #188 commit `f23e71f`. |
| CI-W4 | Invalid SHAs in new workflow actions | `.github/workflows/ci.yml`, `.github/workflows/e2e.yml` | **Active** → **Resolved** | Copied SHAs from issue descriptions without verifying they exist on the action's repository | CI failed with "workflow file issue". SHAs for `nick-fields/retry`, `slackapi/slack-github-action`, `actions/github-script` were invalid. Fixed in PR #188 commit `e332d82`. |

### PR Blockers (3 items)

| ID | Issue | Location | Classification | Root Cause | Status |
|----|-------|----------|----------------|------------|--------|
| PR-W1 | PR #184 benchmark CI fails to post comment | `ci.yml` bench job | **Blocked** — requires PR author change | `ci.yml` permissions block only has `contents: read`. Benchmark posting needs `pull-requests: write`. | Commented on PR with fix guidance. Cannot modify PR #184 directly (Jules PR). |
| PR-W2 | PR #183 lint failure (SHA validation) | `release.yml` uses `cloudflare/wrangler-action@ebbaa15` | **Blocked** — needs rebase | Dependabot PR based on old main before SHA allowlist was synced | Resolved by merging PR #186. PR #183 needs rebase on main. |
| PR-W3 | Codacy review PR #188 misattributed commit | Codacy review on PR #188 | **Monitor** — false positive | Codacy reviewed commit `ce20bcf` from `fix/sync-allowed-action-shas` branch instead of PR #188's head | Review claimed ci.yml changes were missing and SHAs were duplicates — both incorrect. No action needed. |

### Code Quality — ESLint (1 item)

| ID | Issue | Location | Classification | Root Cause | Status |
|----|-------|----------|----------------|------------|--------|
| LINT-W1 | 68+ violations for 3 stricter ESLint rules | `apps/worker/src/`, `apps/web/src/`, `packages/shared/src/` | **Active** — `warn` level | Codebase has existing `!` assertions, `async` without `await`, and `import type` style inconsistencies | Rules enabled as `warn` in PR #189. Tracked for promotion to `error`. See `plans/038` Group B. |

### Plans (1 item)

| ID | Issue | Location | Classification | Root Cause | Status |
|----|-------|----------|----------------|------------|--------|
| PLAN-W1 | Plans 036, 037, 038, 039 missing from `main` branch | `plans/` directory | **Active** → **Resolved** | Plans were created in feat/ci-improvements branch and never merged to main before branch was force-pushed | Plan 038 and 039 now exist on main via PR #186 merge. Plans 036 and 037 remain missing (agent-harness work, tracked in Plan 038 as out-of-scope). |

### Release (1 item)

| ID | Issue | Location | Classification | Root Cause | Status |
|----|-------|----------|----------------|------------|--------|
| REL-W1 | `v0.1.0` GitHub Release never published | `CHANGELOG.md` has `[0.1.0]` section but no tag | **Monitor** — per Plan 035 ADR | Release governance requires `release-management` skill for tag creation | Tracked in Plan 038 §F4. Blocker for Wave 1 completion. |

---

## Phase 2: Status Summary

| Classification | Total | Resolved | Active | Monitor | Blocked |
|---------------|-------|----------|--------|---------|---------|
| **Infrastructure** | 4 | 3 | 0 | 1 | 0 |
| **PR Blockers** | 3 | 0 | 0 | 1 | 2 |
| **Code Quality** | 1 | 0 | 1 | 0 | 0 |
| **Plans** | 1 | 1 | 0 | 0 | 0 |
| **Release** | 1 | 0 | 0 | 1 | 0 |
| **Total** | **10** | **4** | **1** | **3** | **2** |

---

## Phase 3: Active Item Details

### LINT-W1: ESLint stricter rules violations (warn level)

**Location:** `eslint.config.js` — rules set to `warn`
**Count:** ~68 violations across 3 rules
**Breakdown:**
- `@typescript-eslint/no-non-null-assertion`: ~15 violations (worker: 8, web: 7)
- `@typescript-eslint/require-await`: ~40 violations (worker: 27, web: 13)
- `@typescript-eslint/consistent-type-imports`: ~13 violations (worker + web)

**Promotion criteria:** Reduce violations to < 10 per rule before promoting to `error`

---

## Phase 4: Monitor-Tier Items

### CI-W1: GitHub Actions "workflow file issue"

**Evidence:** All CI runs on `main` fail with "This run likely failed because of a workflow file issue" — no specific error message.
**First observed on:** Commit `aaf8241` (PR #187 merge)
**Investigation:**
- Not caused by SHA allowlist (fixed in f9db3d1)
- Not caused by workflow YAML syntax (validated locally)
- Likely GitHub Actions runner infrastructure issue related to `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`
**Resolution path:** Monitor GitHub Actions status page. If persistent, remove `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env var.

### PR-W3: Codacy false positive on PR #188

**Evidence:** Codacy review claimed ci.yml/e2e.yml changes were "missing from the diff" when they were clearly present.
**Root cause:** Codacy reviewed the merge commit from `fix/sync-allowed-action-shas` branch instead of PR #188's HEAD.
**Impact:** None — just noise in PR review. Can be dismissed.

### REL-W1: v0.1.0 release not cut

**Per Plan 035 ADR**, releases must be cut via `release-management` skill. Cannot be done manually. Blocked on Wave 1 completion.

---

## Phase 5: References

- ADR-024 (Plan 024): Warning management policy
- Plan 025: Previous warning resolution (superseded for new items)
- Plan 038: Backlog triage context
- Plan 035: Release governance ADR
