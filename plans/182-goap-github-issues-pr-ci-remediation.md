# GOAP: GitHub Issues, PR, And CI Remediation

Status: ✅ COMPLETED (via Plans 186-196)
Date: 2026-07-14

## Goal

Review all open GitHub issues and pull requests, identify merge blockers, and ensure CI readiness requirements are explicit and enforceable.

## Actions

1. Query open issues:
   - `gh issue list --state open --limit 100 --json number,title,labels,assignees,updatedAt,url`
2. Query open pull requests:
   - `gh pr list --state open --limit 50 --json number,title,headRefName,baseRefName,isDraft,mergeStateStatus,reviewDecision,statusCheckRollup,updatedAt,url`
3. For every open PR, inspect:
   - `gh pr view <PR> --json number,title,headRefName,baseRefName,mergeStateStatus,reviewDecision,statusCheckRollup,files,commits,url`
   - `gh pr checks <PR>`
4. For PRs with Codacy checks, inspect:
   - `codacy pull-request gh d-oit do-epub-studio <PR> --output json`
5. Classify each PR:
   - ready after passing checks
   - blocked by CI
   - blocked by review
   - blocked by conflicts
   - blocked by missing issue/ADR/GOAP linkage
6. Classify open issues by severity, affected subsystem, and whether they map to an existing plan.

## Required Output

- A table of open PRs with merge state, review state, failing checks, and next action.
- A table of open issues with labels, subsystem, risk, and recommended owner or plan.
- Explicit list of CI failures that must be fixed before merge.

## Acceptance Criteria

- No open PR is recommended for merge unless all required checks pass.
- CI failures are never dismissed as pre-existing without a linked active GOAP and ADR.
- Codacy findings are fixed in code unless a last-resort suppression has an inline justification.
- The final PR containing this audit has passing `gh pr checks <PR>` before merge.
