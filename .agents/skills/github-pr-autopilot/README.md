# GitHub PR Autopilot

Automates the entire lifecycle of a GitHub Pull Request — from conflict
resolution through comment processing to merge.

## Prerequisites

- **GitHub CLI** (`gh`) ≥ 2.70.0
- **git** ≥ 2.40.0
- **jq** ≥ 1.7
- Write permissions on the target repository
- `gh` must be authenticated: `gh auth login`

## Quick Start

```bash
# Verify your GitHub account matches the repo owner
bash scripts/verify-auth.sh

# Run the autopilot on PR #123
bash scripts/autopilot.sh 123
```

## What It Does

1. **Verifies authentication** – Ensures the active `gh` account matches the
   repository owner, switching accounts if needed.
2. **Checks PR labels** – Refuses to auto‑merge PRs with `release:cut`,
   `WIP`, or `DO NOT MERGE` labels.
3. **Checks sensitive files** – Halts if the PR touches auth, security, or
   permission code.
4. **Resolves conflicts** – Auto‑resolves simple conflicts (lockfiles, imports,
   JSON/Toml) and halts on complex ones.
5. **Processes review comments** – Classifies comments as must‑fix (halt),
   should‑fix (acknowledge), or discussion (reply politely).
6. **Waits for CI** – Re‑checks status checks after each action.
7. **Merges** – Uses `gh pr merge --squash --delete-branch --auto` when all
   conditions are met.

## When NOT to Use

- PRs with `release:cut` or `release` labels → use `release-management` skill
- PRs touching auth, security, or permission code → requires human review
- PRs with `WIP` or `DO NOT MERGE` labels
- PRs where the base branch has custom protection rules

## Scripts

| Script | Purpose |
|--------|---------|
| `verify-auth.sh` | Verify and switch GitHub accounts |
| `resolve-conflicts.sh <PR>` | Analyse and resolve merge conflicts |
| `process-comments.sh <PR>` | Triage and respond to review comments |
| `autopilot.sh <PR>` | Main orchestration loop |

## Evaluation

Run the eval suite to validate the skill:

```bash
# Evals are defined in evals/evals.json
# Run with your agent's eval framework
```

## Integration

This skill integrates with:
- **github-workflow** – For branch creation and Actions monitoring
- **code-review-assistant** – For holistic PR review
- **release-management** – For release PRs (defer to this skill)
- **cicd-pipeline** – For CI/CD workflow configuration

## License

MIT
