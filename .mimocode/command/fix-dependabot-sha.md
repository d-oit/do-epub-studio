---
name: fix-dependabot-sha
description: Fix Dependabot PRs that fail zizmor SHA allowlist by adding new action SHAs to validate-shas.sh
triggers:
  - fix dependabot sha
  - zizmor sha allowlist
  - dependabot ci failure
  - validate-shas
  - action sha missing
params:
  - name: pr
    description: "PR number to fix (or 'all' for all failing dependabot PRs)"
    default: all
---

# Fix Dependabot SHA Allowlist Failures

When Dependabot bumps a GitHub Action to a new commit SHA, `scripts/validate-shas.sh` rejects it because the new SHA is not in the `ALLOWED_SHAS` array. This causes the Pre-commit Hooks CI check to fail with a zizmor error.

## Step 1 — Identify the Failing PR

```bash
# List all open Dependabot PRs
gh pr list --author "app/dependabot" --json number,title,statusCheckRollup

# Or check specific PR
gh pr checks <PR_NUMBER>
```

Look for Pre-commit Hooks ❌ with zizmor-related error.

## Step 2 — Find the New SHA

```bash
# Get the SHA dependabot is trying to use
gh pr view <PR_NUMBER> --json headRefName --jq '.headRefName'

# Extract the SHA from the branch name (format: dependabot/group-or-name-<sha>)
BRANCH=$(gh pr view <PR_NUMBER> --json headRefName --jq '.headRefName')
SHA=$(echo "$BRANCH" | grep -oP '[0-9a-f]{40}$')

# Verify the SHA exists
gh api repos/<owner>/<repo>/commits/$SHA --jq '.sha'
```

## Step 3 — Add SHA to allowlist

```bash
# Read current allowlist
grep -A 50 'ALLOWED_SHAS' scripts/validate-shas.sh

# Add the new SHA (append to the array before the closing parenthesis)
# Edit scripts/validate-shas.sh and add:
#   "<owner>/<repo>@<sha>",
```

## Step 4 — Push fix to the Dependabot branch

GitHub API does NOT allow changing the head branch on bot-authored PRs.
Push the fix commit directly to the Dependabot branch instead.

```bash
# Create a fix branch from the dependabot branch
git fetch origin $BRANCH
git checkout -b fix-$BRANCH origin/$BRANCH

# Make the change and commit
git add scripts/validate-shas.sh
git commit -m "fix(ci): add new action SHA to allowlist"

# Push directly to the Dependabot branch
git push origin HEAD:$BRANCH

# Alternative: force-push if the branch is ahead
git push origin HEAD:$BRANCH --force-with-lease
```

## Step 5 — Verify CI passes

```bash
# Wait for CI to re-run
sleep 60
gh pr checks <PR_NUMBER>
```

## Step 6 — Handle Multiple Failing PRs

When multiple Dependabot PRs fail with SHA issues:

```bash
# Fix each PR in parallel (in separate worktrees or sequentially)
for PR in $(gh pr list --author "app/dependabot" --json number --jq '.[].number'); do
  echo "Processing PR #$PR..."
  gh pr checks $PR | grep -E "(fail|error)" || echo "  All green, skipping"
done
```

## Common Gotchas

- **`gh pr edit --head` silently ignored for bot PRs:** GitHub API doesn't allow changing head branch on Dependabot-authored PRs. Always push directly to the Dependabot branch.
- **Use `--force-with-lease` not `--force`:** Prevents overwriting commits you haven't seen.
- **Verify SHA before adding:** Run `gh api repos/<owner>/<repo>/commits/<sha>` to confirm the SHA exists and belongs to the expected action.
- **Multiple SHAs may be needed:** A single Dependabot PR may bump multiple actions. Check all failing checks, not just the first one.

## Reference

- SHA allowlist: `scripts/validate-shas.sh` (ALLOWED_SHAS array)
- Validation script: `scripts/validate-workflows.sh` (calls zizmor + is_allowed_sha())
- AGENTS.md: TIER 1 — "MUST validate workflows via validate-workflows.sh"
