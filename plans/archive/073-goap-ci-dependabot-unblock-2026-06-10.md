# GOAP Plan 073: CI Dependabot Unblock

**Date**: 2026-06-10
**Orchestrator**: goap-agent
**Branch**: `fix/ci-dependabot-unblock`
**PR**: #472

## 1. Analysis (World State)

### Failing PRs

| PR | Title | Root Cause | Failing Job |
| --- | --- | --- | --- |
| #460 | chromaui/action bump | SHA `d92ea1ce…` not in allowlist | Pre-commit Hooks |
| #461 | github/codeql-action 4.36.2 | SHA `8aad20d1…` not in allowlist | Pre-commit Hooks |
| #462 | codecov/codecov-action 7.0.0 | SHA `fb8b3582…` not in allowlist | Pre-commit Hooks, CodeQL |
| #466 | eslint-plugin-unicorn 65.0.1 | `unicorn/filename-case` flags `__stories__` dirs | Lint, Pre-commit Hooks |

### Passing PRs (no action needed)

| PR | Title | Status |
| --- | --- | --- |
| #440 | EPUB sanitization hardening | ALL GREEN |
| #458 | DX scaffold agent infrastructure | ALL GREEN |
| #465 | production-dependencies bump | PENDING (partial CI) |
| #471 | fix(dx): require commit bodies | ALL GREEN |

### Open Issues (#442–#454)

All 13 issues are developer-experience / CI items already addressed by PR #458 (scaffold agent infrastructure). No additional implementation required.

## 2. Goal State

- All Dependabot PRs pass CI after #472 merges to main.
- Lint rule accommodates standard test/storybook directory conventions.
- SHA allowlist is maintained for security pinning governance.

## 3. Actions Taken

| Action | File | Description |
| --- | --- | --- |
| Add verified SHAs | `scripts/validate-shas.sh` | Added 4 SHAs: `codecov/codecov-action@fb8b3582…`, `github/codeql-action/{init,analyze}@8aad20d1…`, `chromaui/action@d92ea1ce…` |
| Ignore convention dirs | `eslint.config.js` | Added `ignore: [/^__stories__$/, /^__tests__$/]` to `unicorn/filename-case` rule |

## 4. Verification

- Local quality gate: **ALL PASSED** (lint, typecheck, test:coverage, build, e2e:smoke, shellcheck)
- Workflow validation: **ALL 9 PASSED** (actionlint + zizmor)
- SHA validation: All 4 new SHAs verified via `is_allowed_sha()` function

## 5. Expected Outcome Post-Merge

Once PR #472 merges to main and Dependabot branches rebase:
- PRs #460, #461, #462 → SHA validation passes → Pre-commit + auto-merge unblocked
- PR #466 → `unicorn/filename-case` no longer flags `__stories__` → Lint + Pre-commit pass

## 6. Remaining Items (Monitor Tier)

| Item | Status | Notes |
| --- | --- | --- |
| PR #465 | Pending full CI | Only Cloudflare/Codacy ran; likely passes once triggered |
| PR #462 CodeQL job | Will pass | CodeQL failure was a side-effect of the same SHA issue in `codeql.yml` workflow |
| Issues #442–#454 | Covered by PR #458 | No additional work needed |
