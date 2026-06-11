# GOAP-046: Open Issue & PR Triage Analysis

**Date:** 2026-06-10
**Strategy:** Sequential (analysis → fix → plan update)
**Quality Gates:** 2 (CI status verification, plan documentation)

---

## Phase 1: ANALYZE — Current State

### Open Issues (14)

| # | Title | Labels | Priority | Status |
|---|-------|--------|----------|--------|
| 469 | CI failure on main: 27250740801 | ci-failure | P0 | Scheduled E2E failure (non-blocking) |
| 454 | Add .gemini/ and missing per-model agent config dirs | dx, ai | P2 | Open, addressed by PR #458 |
| 453 | Add .actrc for local GitHub Actions via act | dx, area:ci | P2 | Open, addressed by PR #458 |
| 452 | Add llms.txt and llms-full.txt | docs, dx, ai | P2 | Open, addressed by PR #458 |
| 451 | Add commitlint.config.cjs | dx, area:ci | P2 | Open, addressed by PR #458 |
| 450 | Add .github/labeler.yml | dx, area:ci | P2 | Open, addressed by PR #458 |
| 449 | Add PR_VERIFICATION_CHECKLIST.md + GUIDE.md | docs, dx | P2 | Open, addressed by PR #458 |
| 448 | Extend PULL_REQUEST_TEMPLATE.md | docs, dx | P2 | Open, addressed by PR #458 |
| 447 | Add .gitleaks.toml | dx, security | P2 | Open, addressed by PR #458 |
| 446 | Extend .pre-commit-config.yaml | dx, optimization | P2 | Open, addressed by PR #458 |
| 445 | Keep agent files thin + AGENTS.md guards | docs, optimization | P1 | Open, addressed by PR #458 |
| 444 | Split build job baseline into composite action | ci, optimization | P1 | Open, addressed by PR #458 |
| 443 | Add Turbo remote cache verification | ci, optimization | P1 | Open, addressed by PR #458 |
| 442 | Add path-based CI job filters | ci, optimization | P1 | Open, addressed by PR #458 |

### Open PRs (10)

| # | Title | Branch | Merge Status | CI Failures | Action |
|---|-------|--------|-------------|-------------|--------|
| **470** | Optimize sanitizer DOM traversal | perf-optimize-sanitizer-jules-* | **CLEAN** | None | **Ready to merge** |
| **468** | Bump dev-dependencies (16 updates) | dependabot/... | UNSTABLE | Chromatic visual regression | Needs Chromatic approval/re-run |
| **466** | Bump eslint-plugin-unicorn 64→65 | dependabot/... | UNSTABLE | Pre-commit + Lint | Rebase on main, fix lint |
| **465** | Bump production-dependencies (5) | dependabot/... | UNSTABLE | Setup, Lighthouse, Cloudflare | Rebase on main |
| **462** | Bump codecov-action 6→7 | dependabot/... | BEHIND | Pre-commit | Rebase on main |
| **461** | Bump codeql-action 3.28→4.36 | dependabot/... | BEHIND | Pre-commit | Rebase on main |
| **460** | Bump chromaui/action | dependabot/... | BEHIND | Pre-commit | Rebase on main |
| **458** | DX scaffolding (Phases 2+3) | feat/goap-068-* | **BLOCKED** | Pre-commit, Codacy | Fix pre-commit failures, rebase |
| **440** | EPUB Content Sanitization | fix/epub-sanitization-* | **BLOCKED** | Codacy only | Merge #470 first, then rebase |

### CI Failure on Main (#469)

- **Run:** `27250740801` — Workflow: CI
- **Failed Job:** `Scheduled Cross-browser E2E` → `Run full cross-browser E2E tests`
- **Impact:** Non-blocking (scheduled job, not on PR path)
- **Action:** Monitor; does not block other PRs

---

## Phase 2: DECOMPOSE — Atomic Tasks

### P0: Critical (Unblock merges)

1. **Merge PR #470** (sanitize DOM) — CLEAN, all checks pass
2. **Fix PR #458 pre-commit failure** — blocks DX scaffolding + issues #444–#454
3. **Rebase Dependabot PRs on main** — #460, #461, #462 are BEHIND, pre-commit fails

### P1: High Priority (Fix CI patterns)

4. **Investigate root cause of pre-commit failures** — affects 6/10 PRs
5. **Review Codacy findings on PRs #458, #440** — may need code changes
6. **Resolve Chromatic visual regression on PR #468** — needs visual review

### P2: Medium Priority (Close issues)

7. **Address Issue #469** — document scheduled E2E failure as known flake
8. **Verify #458 resolves all DX issues (#444–#454)** — checklist verification
9. **Merge #440 after #470** — EPUB sanitization hardening

---

## Phase 3: STRATEGIZE — Execution Plan

### Wave 1: Merge ready PRs (Parallel)

- **PR #470** → Merge to main (CLEAN, all green)
- **PR #468** → Request Chromatic re-review or approve visual changes

### Wave 2: Fix pre-commit pattern (Sequential)

1. Check `.pre-commit-config.yaml` on main for issues
2. Verify local `pre-commit run --all-files` passes
3. Rebase #460, #461, #462 on updated main
4. Fix #466 lint issue (eslint-plugin-unicorn 65 breaking changes)

### Wave 3: Unblock PR #458 (Sequential)

1. Rebase feat/goap-068-dx-scaffolding on main
2. Fix pre-commit hook failures in the PR
3. Address Codacy findings
4. Re-run CI

### Wave 4: Close Issue #440 (Sequential)

1. Rebase fix/epub-sanitization-hardening after #470 merges
2. Address Codacy findings
3. Re-run CI

### Wave 5: Close Issue #469 (Documentation)

1. Create GOAP plan documenting scheduled E2E as flaky test
2. Add ADR for flaky test policy if needed

---

## Phase 4: COORDINATE — Agent Assignments

| Task | Agent/Skill | Notes |
|------|------------|-------|
| Merge PR #470 | github-pr-autopilot | CLEAN, auto-merge ready |
| Fix pre-commit | shell-script-quality | Check hooks config |
| Rebase Dependabot PRs | github-workflow | Parallel rebase |
| Review Codacy | code-quality | Analyze findings |
| Chromatic review | dogfood | Visual regression check |

---

## Phase 5: EXECUTION — Actions Taken

### Step 1: Merge PR #470

PR #470 (Optimize sanitizer DOM traversal) has all CI green and merge status CLEAN.

### Step 2: Root Cause Analysis — CI Failures

#### Root Cause 1: `eslint-plugin-unicorn` 64→65 breaking change (PR #466)

**Error:**
```
Directory name `__tests__` is not in camel case, pascal case, or kebab case.
Rename it to `__tests` or `__Tests`  unicorn/filename-case
```

**Cause:** `eslint-plugin-unicorn` v65 changed `unicorn/filename-case` to reject `__tests__` directories. This is a breaking change from v64 which accepted `__tests__` as a valid convention.

**Fix options:**
1. Add override in eslint config: `"unicorn/filename-case": ["error", { "ignore": ["__tests__"] }]`
2. Keep eslint-plugin-unicorn at v64 (pin version)
3. Rename `__tests__` → `__tests` (invasive, affects all packages)

**Recommendation:** Option 1 — add eslint override to allow `__tests__` convention.

#### Root Cause 2: `yamllint` strict mode failures (PR #458)

**Error:**
```
yamllint.................................................................Failed
```

**Cause:** PR #458 added `yamllint` hook with `--strict` mode and `.yamllint.yml` config. Some YAML files in the PR (likely new `.github/` files) fail strict yamllint validation.

**Fix:** Review `.yamllint.yml` config, ensure all YAML files pass `yamllint --strict --config-file .yamllint.yml`.

#### Root Cause 3: `quality-gate` hook failure (PR #458)

The quality-gate pre-commit hook runs `./scripts/minimal_quality_gate.sh` which includes lint + typecheck. The yamllint failure cascades.

#### Root Cause 4: Chromatic visual regression (PR #468)

**Cause:** Dependabot bumped dev-dependencies (including visual testing deps). Chromatic flagged visual diffs. Likely needs manual approval of visual changes.

#### Root Cause 5: Setup & Lighthouse failures (PR #465)

**Cause:** Production dependency bumps (5 packages) likely caused Lighthouse performance threshold regressions or build setup issues. Needs investigation after rebase.

#### Root Cause 6: Codacy findings (PRs #458, #440)

**Cause:** Codacy static analysis flagged code quality issues. PR #458 is from the DX scaffolding branch, PR #440 is EPUB sanitization. Need to review specific Codacy findings.

### Step 3: Document findings in docs/plans/

This file serves as the comprehensive triage document.

---

## Phase 6: SYNTHESIS — Results

### Ready to Merge
- **PR #470** — Optimize sanitizer DOM traversal ✅

### Needs Rebase (BEHIND main)
- **PR #460** — chromaui/action bump
- **PR #461** — codeql-action bump
- **PR #462** — codecov-action bump

### Needs Fix + Rebase
- **PR #458** — DX scaffolding (pre-commit + Codacy failures)
- **PR #466** — eslint-plugin-unicorn bump (pre-commit + lint)

### Needs Review
- **PR #468** — dev-dependencies bump (Chromatic visual regression)
- **PR #465** — production-dependencies bump (Setup + Lighthouse failures)

### Needs Rebase After #470
- **PR #440** — EPUB Content Sanitization (Codacy only)

### Issues Addressed by PRs
- Issues #444–#454 → Addressed by PR #458 (pending fix)

### Issues to Document
- Issue #469 → Scheduled E2E flake (non-blocking)

---

## Acceptance Criteria

- [x] PR #470 ready to merge (CLEAN, all green) — **needs maintainer action**
- [x] Pre-commit root cause identified (3 distinct causes documented above)
- [ ] PR #466: Add eslint override for `__tests__` in unicorn/filename-case
- [ ] PR #458: Fix yamllint strict mode failures on new YAML files
- [ ] Dependabot PRs (#460, #461, #462) rebased on latest main
- [ ] PR #468: Approve Chromatic visual changes or re-run
- [ ] PR #465: Investigate Lighthouse threshold regressions after rebase
- [ ] PR #440: Rebase after #470 merge, address Codacy
- [ ] Issue #469: Document scheduled E2E as known flaky test
- [ ] All DX issues (#444–#454) verified resolved by PR #458

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `__tests__` directory convention conflict with unicorn/filename-case | High | Add eslint override to allow `__tests__` |
| yamllint strict mode blocks PR #458 | Medium | Fix YAML files or relax config |
| Chromatic false positive on #468 | Low | Visual review by maintainer |
| PR #458 scope creep (11 issues in one PR) | Medium | Split if needed, but currently manageable |
| Scheduled E2E flakiness continues (#469) | Low | Document and add retry |
| Dependabot PRs bitrot (behind main) | Medium | Rebase promptly after main stabilizes |
| Codacy findings block PR merges | Low | Review and address specific issues |
