# Orchestration Guide

How the `pr-review-fix` skill delegates to sub-skills and merges their outputs.

## Sub-Skill Invocation Patterns

### code-review-assistant

**When**: Phase 3 (Code Review)
**Input**: PR diff, file list, risk context
**Output**: Risk assessment, cross-file findings, quality checklist results

Invoke by reading the skill and applying its Phase 1-3 workflow to the PR's changed files. The skill is read-only — it analyzes but does not modify.

### codacy

**When**: Phase 4 (Static Analysis)
**Input**: PR number
**Output**: `isUpToStandards`, `newIssues[]` with `resultDataId`, `filePath`, `lineNumber`, `patternInfo.id`

The Codacy CLI produces JSON. Process each issue:
1. Check `pullRequest.quality.isUpToStandards`
2. For each `newIssues[]` entry, extract the numeric `resultDataId`
3. Apply fix patterns from codacy skill (e.g., `security/detect-non-literal-fs-filename`)
4. Only suppress false positives with `--ignore-reason` as last resort

### security-code-auditor

**When**: Phase 5 (Security Audit)
**Input**: Changed files, PR context
**Output**: Vulnerability list with severity

The skill is read-only. Apply its 4-phase audit:
1. Identify attack surface (auth endpoints, book access, EPUB parsing)
2. Static analysis checklist (injection, secrets, deserialization)
3. EPUB security (DOMPurify patterns)
4. Configuration review (CORS, CSP, HSTS)

### code-quality

**When**: Phase 6 (Quality Check)
**Input**: Changed files
**Output**: Code smells, DRY violations, magic numbers

The skill is read-only. Apply its file/function-level review:
- DRY enforcement
- Single Responsibility verification
- Magic number detection
- Regex safety checks

### goap-agent

**When**: Phase 8 (Complex Fixes)
**Input**: Must-fix items requiring multi-step resolution
**Output**: Implementation plan + executed fixes

Use GOAP methodology for fixes that span multiple files or require architectural decisions. The goap-agent decomposes the fix into atomic tasks and executes them with quality gates.

### github-actions-version-fix

**When**: Phase 8 (CI Action Fixes)
**Input**: Broken action reference from CI failure
**Output**: Corrected YAML with valid version tag or SHA

Use when `gh pr checks` shows a CI failure with "Unable to resolve action".

### github-workflow

**When**: Phase 9 (Re-verify)
**Input**: Branch name
**Output**: CI status, Actions run details

Monitor CI after pushing fixes. Use `gh pr checks --watch` for blocking wait.

## Finding Merge Strategy

When multiple sub-skills report findings on the same file/line:

1. **Dedup**: If two skills flag the same issue (e.g., codacy + security both flag a path traversal), keep the higher severity
2. **Escalate**: If a quality issue is also a security issue, escalate to security severity
3. **Context**: Security findings always override quality findings on the same line

## Severity Escalation Rules

| Source Skill | Default Severity | Escalation |
|-------------|-----------------|------------|
| security-code-auditor | must-fix | Never downgraded |
| codacy (security rules) | must-fix | Never downgraded |
| codacy (quality rules) | should-fix | Escalate to must-fix if pattern is dangerous |
| code-review-assistant | varies | Based on risk level table |
| code-quality | should-fix | Escalate to must-fix if DRY violation causes bug |

## Error Handling

| Scenario | Response |
|----------|----------|
| gh CLI not authenticated | Run `bash scripts/verify-auth.sh`, then retry |
| Codacy CLI not installed | Install via `npm i -g @codacy/analysis-cli @codacy/codacy-cloud-cli` |
| Codacy API token missing | Ask user to set `CODACY_API_TOKEN` env var |
| PR has merge conflicts | Report conflicts, do not auto-fix, suggest `github-pr-autopilot` |
| CI check fails after fix | Investigate failure, fix, re-push |
| Auto-fix introduces regression | Revert fix, report as needs-manual-attention |
