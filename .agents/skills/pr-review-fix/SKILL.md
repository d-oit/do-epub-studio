---
version: "1.0.0"
name: pr-review-fix
description: >
  Comprehensive GitHub PR review and automated fix pipeline. Takes a PR number
  or auto-detects from current branch, runs code review, static analysis,
  security audit, and quality checks, then produces a structured report and
  auto-fixes must-fix issues. Activate for "review PR", "fix PR issues",
  "PR quality check", "review and fix PR #123".
category: workflow
allowed-tools: Read Write Edit Bash Grep Glob
license: MIT
---

# PR Review & Fix

End-to-end GitHub PR review and automated fix pipeline. Orchestrates existing
skills into a single workflow that reviews, reports, and fixes PR issues.

## When to Use

- "review PR #123"
- "review and fix this PR"
- "check PR quality"
- "fix PR issues"
- "PR code review"

## Prerequisites

- GitHub CLI (`gh` ≥ 2.70.0) authenticated
- Codacy CLI installed (`@codacy/analysis-cli`, `@codacy/codacy-cloud-cli`)
- `./scripts/quality_gate.sh` available
- `./scripts/atomic-commit/run.sh` available

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| PR Number | Auto-detect from branch | PR number or full URL |
| Auto-fix | **on** | Fix must-fix issues automatically |
| Scope | full | `full` (all checks) or `diff` (changed files only) |

## Pipeline

### Phase 1: Identify PR

```bash
# From current branch
gh pr view --json number,url,title,headRefName,baseRefName,author,state

# Or use provided number
gh pr view $PR_NUMBER --json number,url,title,headRefName,baseRefName,author,state
```

Stop and ask user if no PR found.

### Phase 2: Fetch Context

```bash
# Files changed
gh pr view $PR --json files --jq '.files[].path'

# Diff
gh pr diff $PR

# CI status
gh pr checks $PR

# Inline review comments (API required, gh pr view misses these)
gh api /repos/:owner/:repo/pulls/$PR/comments

# Reviews
gh api /repos/:owner/:repo/pulls/$PR/reviews
```

### Phase 3: Code Review

Delegate to **`code-review-assistant`** skill. Analyze:
- Modified files and lines changed
- Risk level classification
- Cross-file consistency
- Test coverage verification
- Pattern detection (feature, bug, refactor)

### Phase 4: Static Analysis

```bash
codacy pull-request gh d-oit do-epub-studio $PR --output json > /tmp/codacy-pr.json
```

Delegate to **`codacy`** skill for:
- Processing `newIssues[]` entries
- Checking `isUpToStandards` gate
- Categorizing fixable vs false-positive issues
- Applying fix patterns from codacy skill references

### Phase 5: Security Audit

Delegate to **`security-code-auditor`** skill. Scan for:
- Injection vulnerabilities (SQL, NoSQL, command)
- Hardcoded secrets or tokens
- Unsafe EPUB HTML handling (must use DOMPurify)
- Missing authorization checks
- Public file URL exposure
- File-system path traversal patterns

### Phase 6: Quality Check

Delegate to **`code-quality`** skill. Detect:
- DRY violations (duplicated logic across functions)
- Magic numbers (replace with named constants)
- Long methods (>50 lines) and large classes (>300 lines)
- Long parameter lists (>4 params)
- Dead code, speculative generality
- Regex safety on untrusted input (`matchBounded`/`testBounded`)

### Phase 7: Compile Report

Merge all findings. Use template at `templates/report-template.md`.

Severity classification:

| Severity | Criteria | Auto-fix |
|----------|----------|----------|
| **must-fix** | Security vulns, bugs, CI failures, broken tests | Yes |
| **should-fix** | Code smells, missing tests, style | No (recommend) |
| **informational** | Observations, suggestions | No (note) |
| **nit** | Minor style, formatting | No (optional) |

### Phase 8: Auto-Fix

Fix all **must-fix** issues:

1. **Simple fixes** (formatting, imports, unused vars) → direct Edit
2. **Code quality** (DRY, naming) → direct Edit per code-quality patterns
3. **Complex fixes** (architecture, security) → delegate to **`goap-agent`**
4. **CI action fixes** → delegate to **`github-actions-version-fix`**

Verify after each fix:

```bash
./scripts/minimal_quality_gate.sh
```

**Never auto-fix**: merge conflicts, auth/security logic, release PRs.

### Phase 9: Re-verify

```bash
# Commit and push
git add -A
./scripts/atomic-commit/run.sh --message "fix(scope): address PR review findings" --body "Auto-fixed must-fix issues from PR review"
git push

# Monitor CI
gh pr checks $PR --watch
```

If CI fails, investigate and fix. Never bypass with `--admin`.

## Delegation Map

| Phase | Skill | Purpose |
|-------|-------|---------|
| Code Review | `code-review-assistant` | Holistic PR analysis |
| Static Analysis | `codacy` | Required check orchestration |
| Security | `security-code-auditor` | Vulnerability audit |
| Quality | `code-quality` | Code smell detection |
| Complex Fixes | `goap-agent` | Multi-step fix orchestration |
| CI Fix | `github-actions-version-fix` | Broken action references |
| CI Monitor | `github-workflow` | Actions status polling |

## Quality Checklist

- [ ] PR identified and context fetched
- [ ] All review phases completed
- [ ] Findings classified by severity
- [ ] Must-fix issues auto-fixed
- [ ] Quality gate passes after fixes
- [ ] All CI checks pass
- [ ] Report delivered to user

## References

- `references/orchestration-guide.md` — Detailed delegation patterns
- `templates/report-template.md` — Report output format
- `.agents/skills/code-review-assistant/SKILL.md` — Review patterns
- `.agents/skills/codacy/SKILL.md` — Static analysis patterns
- `.agents/skills/security-code-auditor/SKILL.md` — Security patterns
- `.agents/skills/code-quality/SKILL.md` — Quality patterns
- `.agents/skills/goap-agent/SKILL.md` — Complex fix orchestration
