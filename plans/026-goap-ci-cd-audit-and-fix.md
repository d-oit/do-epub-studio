# 026 — GOAP: GitHub Actions CI/CD Audit & Fix Plan

**Created**: 2026-05-15
**Status**: Planning
**Scope**: `.github/workflows/` (5 files) — full CI/CD pipeline audit

## Primary Goal

Identify all failing CI jobs across GitHub Actions workflows, catalog every gap vs. 2026 best practices, and produce an actionable fix plan with prioritized tasks.

## Failure Summary (as of 2026-05-15)

| Workflow | Job | Root Cause | Run ID | Severity |
|----------|-----|-----------|--------|----------|
| CI | Unit Tests | Property-based test failure: `__proto__` key bypasses `strict()` rejection in `MultiSignalLocatorSchema` | 25881518245 | **P0** |
| E2E Tests | Playwright E2E | Script `pnpm test:e2e:prod` does not exist; suggestion says use `pnpm test:e2e:smoke` | 25897870140 | **P0** |
| CI | Build, Prod E2E Smoke | Skipped (downstream of Unit Tests failure) | 25881518245 | P1 |

---

## 1. CRITICAL FAILURES (P0 — Block Merges/Releases)

### F1: Unit Tests — `__proto__` Prototype Pollution Bypass

- **File**: `packages/shared/src/__tests__/schemas.test.ts:489`
- **Error**: `Property failed after 69 tests — Counterexample: [" "," "," ","__proto__"]`
- **Expected**: Schema with `strict()` rejects objects with extra keys
- **Actual**: When extra key is `__proto__`, Zod's `strict()` does not reject it (prototype chain edge case)
- **Fix**: Add explicit `__proto__` guard in the Zod schema or adjust test to skip `__proto__` as a fuzzing target
- **Estimate**: 15 min

### F2: E2E Tests — Missing npm Script

- **File**: `.github/workflows/e2e.yml:38`
- **Error**: `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "test:e2e:prod" not found`
- **Fix**: Change `pnpm test:e2e:prod` to the correct script name (likely `pnpm test:e2e` or `pnpm test:e2e:smoke`)
- **Estimate**: 5 min

---

## 2. STRUCTURAL GAPS (P1 — Inefficiency, Maintenance Burden)

### S1: Massive Step Duplication Across Jobs

**Problem**: Every job in `ci.yml` repeats the identical 4-step bootstrap:
```yaml
- uses: actions/checkout@...
- uses: pnpm/action-setup@...
- uses: actions/setup-node@...
- run: pnpm install --frozen-lockfile
```
This occurs in **7 jobs** × 4 steps = **28 duplicated steps**.

**2026 Best Practice**: Use a **reusable workflow** or **composite action** for the bootstrap, or at minimum use `actions/cache@v4` with `setup-node`'s built-in caching (already partially done via `cache: 'pnpm'`).

**Fix**: Create `.github/actions/setup-pnpm/action.yml` composite action

**Impact**: Reduces workflow lines by ~60%, single point of version updates

### S2: No Dependency Caching Beyond pnpm Store

**Problem**: `setup-node` caches the pnpm store but not `node_modules`. Every job reinstalls 780 packages from cache (~5-6s).

**2026 Best Practice**: Use `actions/cache@v4` for `node_modules` or Turborepo remote caching.

**Fix**: Add explicit `actions/cache@v4` step for `node_modules` keyed by `pnpm-lock.yaml` hash, or enable Turborepo remote caching with `TURBO_TOKEN` and `TURBO_TEAM`

### S3: No Concurrency Control

**Problem**: No `concurrency` groups defined. Multiple PRs or pushes can trigger parallel runs, wasting CI minutes and creating race conditions on shared artifacts.

**2026 Best Practice**: Use `concurrency` with `cancel-in-progress: true` for PRs:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### S4: No `paths`/`paths-ignore` Filters

**Problem**: Every push/PR triggers the full CI pipeline even if only docs changed.

**2026 Best Practice**: Add `paths-ignore` to skip CI for `.md`, `.github/`-only changes:
```yaml
on:
  pull_request:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '**.md'
```

---

## 3. SECURITY GAPS (P1-P2)

### SG1: Node.js Runtime Deprecation (Time-Bomb)

**Problem**: `ci.yml` uses `FORCE_JAVASCRIPT_ACTIONS_TO_NODE22` (correct), but `e2e.yml` and `release.yml` use `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` (also valid). However, a deprecation warning confirms several actions still use Node.js 20 runtime:
```
Node.js 20 actions are deprecated... Actions will be forced to run with Node.js 24 by default starting June 2nd, 2026.
```

**Affected Actions**: `actions/checkout`, `actions/setup-node`, `actions/upload-artifact` (currently at pinned SHAs compiled for Node 20)

**2026 Best Practice**: Use `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` consistently. Update to latest SHAs of actions that support Node 24.

**Deadline**: June 2, 2026 (hard deadline — actions break)

### SG2: No CodeQL / SAST Scanning

**Problem**: No static application security testing in any workflow.

**2026 Best Practice**: Add `github/codeql-action` for JavaScript/TypeScript scanning on `push` to `main` and `pull_request`.

### SG3: Over-Permissive `smart-update-pr.yml` Permissions

**Problem**: Top-level `permissions: {}` but job-level permissions are `contents: write, pull-requests: write, issues: write`. The workflow accepts `/smart-update` comments from any `OWNER`, `MEMBER`, or `COLLABORATOR` — could be abused.

**2026 Best Practice**: Require `COLLABORATOR` minimum, add rate limiting, use `GITHUB_TOKEN` with minimal scoped permissions per job.

### SG4: `dependabot-auto-merge.yml` Uses `DEPENDABOT_PAT`

**Problem**: The workflow uses `secrets.DEPENDABOT_PAT` instead of `GITHUB_TOKEN`. This is a personal access token that could have excessive permissions.

**2026 Best Practice**: Use `GITHUB_TOKEN` for auto-merge. If PAT is required, scope it to minimum: `contents: read, pull-requests: write`.

### SG5: Release Workflow Has Hardcoded `gitHubToken` in Wrangler Deploy

**Problem**: `release.yml:59` passes `gitHubToken: ${{ secrets.GITHUB_TOKEN }}` to wrangler-action. This is not needed for Pages deploy and leaks the token scope.

---

## 4. RELIABILITY GAPS (P2)

### R1: No `run-name` for Workflow Runs

**Problem**: All workflows use default naming. Hard to identify specific runs in the Actions tab.

**2026 Best Practice**: Add descriptive `run-name`:
```yaml
run-name: ${{ github.event_name == 'pull_request' && format('PR #{0}: {1}', github.event.pull_request.number, github.event.pull_request.title) || github.event.head_commit.message }}
```

### R2: No Slack/Discord Notifications

**Problem**: No notification on CI failure. Team only discovers failures by checking GitHub.

**2026 Best Practice**: Add notification step on failure using `slackapi/slack-github-action` or webhook.

### R3: `smoke-e2e` and `e2e-smoke` Are Redundant

**Problem**: `ci.yml` has both `smoke-e2e` (lines 126-158) and `e2e-smoke` (lines 190-236) — two different E2E smoke test jobs with overlapping purpose.

**2026 Best Practice**: Consolidate into one job with conditional execution (dev vs prod build).

### R4: E2E Workflow Has No Retry on Transient Failure

**Problem**: Scheduled E2E tests run once daily at 2 AM. If the production endpoint is temporarily down, the entire run fails with no retry.

**2026 Best Practice**: Use `max-Attempts: 2` or add a retry wrapper step.

### R5: No Artifact Attestation (SBOM)

**Problem**: Release workflow creates a GitHub Release but does not generate or attach an SBOM or SLSA provenance.

**2026 Best Practice**: Use `actions/attest-build-provenance` and `anchore/sbom-action` for supply chain security.

---

## 5. MINOR GAPS (P3)

### M1: Inconsistent `retention-days` for Artifacts

| Job | Artifact | Retention |
|-----|----------|-----------|
| test | verification-output | 7 days |
| smoke-e2e | playwright-smoke-report | 7 days |
| e2e-smoke | playwright-report-smoke | 7 days |
| e2e (scheduled) | playwright-report | 30 days |

**Fix**: Standardize to 14 days for PR artifacts, 30 days for scheduled runs.

### M2: `build` Job Uploads `apps/web/dist/` with 1-Day Retention

**Problem**: Build artifacts expire after 1 day, making it impossible to debug a failed `e2e-smoke` job that ran the next day.

**Fix**: Set `retention-days: 3` to bridge the gap.

### M3: `release.yml` Does Not Run Build Verification Before Deploy

**Problem**: Lint → Typecheck → Test → Build → Deploy. If build fails, the deploy steps are skipped (correct). But there's no `needs:` chain to ensure build artifacts pass verification before deploy.

### M4: No Workflow for Stale Branch/Issue Cleanup

**Problem**: No automation to close stale PRs, delete merged branches, or clean up old workflow runs.

---

## 6. 2026 BEST PRACTICES CHECKLIST

| Practice | Status | Workflow(s) |
|----------|--------|-------------|
| Pin actions to full SHA | ✅ Done | All |
| Minimal `permissions` | ⚠️ Partial | smart-update-pr, dependabot-auto-merge |
| `concurrency` groups | ❌ Missing | All |
| `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` | ⚠️ Inconsistent | ci.yml uses NODE22, others NODE24 |
| `actions/cache@v4` for node_modules | ❌ Missing | ci.yml |
| CodeQL / SAST | ❌ Missing | All |
| `paths-ignore` filters | ❌ Missing | ci.yml |
| `run-name` | ❌ Missing | All |
| Reusable workflow / composite action | ❌ Missing | ci.yml |
| Artifact attestation / SBOM | ❌ Missing | release.yml |
| Notification on failure | ❌ Missing | All |
| OIDC for Cloudflare deploy | ❌ Missing | release.yml |
| Dependabot for action updates | ? Unknown | N/A (check .github/dependabot.yml) |
| Timeout-minutes | ❌ Missing | All |

---

## 7. GOAP DECOMPOSITION — Fix Plan

### Phase 1: Emergency Fixes (P0)

| # | Task | Agent | Est | Deps |
|---|------|-------|-----|------|
| 1.1 | Fix `__proto__` prototype pollution test in `packages/shared/src/__tests__/schemas.test.ts` | general | 15min | none | ✅ COMPLETED |
| 1.2 | Fix `e2e.yml` — change `pnpm test:e2e:prod` to correct script | general | 5min | none | ✅ COMPLETED |
| 1.3 | Run quality gate to verify fixes | test-runner | 10min | 1.1, 1.2 | ✅ COMPLETED |

### Phase 2: Structural Improvements (P1)

| # | Task | Agent | Est | Deps |
|---|------|-------|-----|------|
| 2.1 | Create `.github/actions/setup-pnpm/action.yml` composite action | cloudflare-worker-api | 30min | none |
| 2.2 | Refactor `ci.yml` to use composite action | cloudflare-worker-api | 20min | 2.1 | ✅ COMPLETED |
| 2.3 | Add `concurrency` groups to all workflows | cloudflare-worker-api | 15min | none | ✅ COMPLETED |
| 2.4 | Add `paths-ignore` filters to ci.yml | cloudflare-worker-api | 10min | none | ✅ COMPLETED |
| 2.5 | Add `timeout-minutes` to all jobs | cloudflare-worker-api | 10min | none | ✅ COMPLETED |
| 2.6 | Standardize `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` across all workflows | cloudflare-worker-api | 5min | none | ✅ COMPLETED |
| 2.7 | Add `run-name` to all workflows | cloudflare-worker-api | 10min | none | ✅ COMPLETED |

### Phase 3: Security Hardening (P1)

| # | Task | Agent | Est | Deps |
|---|------|-------|-----|------|
| 3.1 | Add CodeQL analysis workflow | security-code-auditor | 20min | none |
| 3.2 | Fix `smart-update-pr.yml` permissions and add rate limiting | secure-invite-and-access | 20min | none | ✅ COMPLETED |
| 3.3 | Fix `dependabot-auto-merge.yml` to use `GITHUB_TOKEN` | secure-invite-and-access | 10min | none | 🔴 |
| 3.4 | Remove unnecessary `gitHubToken` from wrangler-action in release.yml | cloudflare-worker-api | 5min | none | ✅ COMPLETED |

### Phase 4: Reliability & Observability (P2)

| # | Task | Agent | Est | Deps |
|---|------|-------|-----|------|
| 4.1 | Consolidate `smoke-e2e` + `e2e-smoke` into single job pattern | cloudflare-worker-api | 30min | 2.1 |
| 4.2 | Add retry logic to scheduled E2E workflow | cloudflare-worker-api | 15min | 1.2 |
| 4.3 | Add artifact attestation to release workflow | cicd-pipeline | 20min | none |
| 4.4 | Add failure notifications (Slack/webhook) | cicd-pipeline | 15min | none |

### Phase 5: Minor Cleanup (P3)

| # | Task | Agent | Est | Deps |
|---|------|-------|-----|------|
| 5.1 | Standardize artifact retention-days | cloudflare-worker-api | 5min | none | 🔴 |
| 5.2 | Increase build artifact retention to 3 days | cloudflare-worker-api | 5min | none | ✅ COMPLETED |
| 5.3 | Add `needs` chain verification to release.yml | cloudflare-worker-api | 10min | none | ✅ COMPLETED |

---

## 8. Execution Strategy

**Hybrid**: Phase 1 runs sequentially (fixes must land first). Phases 2-5 can run in parallel where tasks are independent.

**Quality Gates** between each phase:
- Phase 1: `pnpm test` passes, `pnpm test:e2e:smoke` passes
- Phase 2: All workflows pass YAML validation, no duplicate steps remain
- Phase 3: CodeQL scan runs successfully, permissions audit passes
- Phase 4: E2E tests pass with retry logic
- Phase 5: All artifact retention values are consistent

---

## 9. Risks

| Risk | Mitigation |
|------|-----------|
| Node 24 forced migration on June 2 — only 18 days away | Priority: complete Phase 2.6 before June 1 |
| Composite action change could break cache keys | Test with both cache-hit and cache-miss scenarios |
| `__proto__` fix might indicate a real Zod limitation | If so, document in an ADR and use a custom refinement |
| Removing `gitHubToken` from wrangler-action might break Pages deploy | Verify with a test deployment on a feature branch |
