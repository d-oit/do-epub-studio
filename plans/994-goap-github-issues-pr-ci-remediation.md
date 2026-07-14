# GOAP: GitHub Issues, Pull Requests, And CI Remediation

Status: proposed
Date: 2026-07-14

## Goal

Review all open GitHub issues and pull requests, identify CI blockers, and define remediation steps so all required checks can pass before merge.

## Commands

- `gh issue list --state open --limit 100 --json number,title,labels,assignees,updatedAt,url`
- `gh pr list --state open --limit 50 --json number,title,headRefName,baseRefName,isDraft,mergeStateStatus,reviewDecision,statusCheckRollup,updatedAt,url`
- `gh pr view <PR> --json number,title,headRefName,baseRefName,mergeStateStatus,reviewDecision,statusCheckRollup,files,commits,url`
- `gh pr checks <PR>`
- `codacy pull-request gh d-oit do-epub-studio <PR> --output json`

## Review Matrix

For every open issue and PR, capture:

- identifier and URL
- status and last update
- affected subsystem
- labels and assignees
- CI state
- Codacy state
- merge conflicts or branch currency
- security or privacy impact
- recommended next action

## Actions

1. Build an issue inventory and group by subsystem.
2. Build a PR inventory and inspect checks for every open PR.
3. Prioritize failing CI, Codacy findings, security issues, merge conflicts, and stale review states.
4. For every failing PR, identify whether the failure is introduced by the PR or already exists on `main`.
5. Fix failures where scoped to the active work; otherwise create active GOAP + ADR follow-up.
6. Do not merge any PR with failing required checks.

## Acceptance Criteria

- Every open PR has a known CI and review state.
- Every failing check has an owner or remediation artifact.
- No PR is recommended for merge until required checks pass.
- The final PR description links this audit and any follow-up plans.

## Verification

- `gh pr checks <PR>` returns passing required checks for merge candidates.
- Codacy PR scan has no new actionable findings.
- Workflow validation and quality gate pass on the audit branch.
