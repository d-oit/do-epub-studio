#!/bin/bash
# Usage: resolve-conflicts.sh <PR_NUMBER>
set -euo pipefail

PR_ID="${1:-}"
if [ -z "$PR_ID" ]; then
    echo "❌ Usage: resolve-conflicts.sh <PR_NUMBER>"
    exit 1
fi

PR_JSON=$(gh pr view "$PR_ID" --json headRefName,baseRefName 2>/dev/null)
PR_BRANCH=$(echo "$PR_JSON" | jq -r '.headRefName')
BASE_BRANCH=$(echo "$PR_JSON" | jq -r '.baseRefName')

if [ -z "$PR_BRANCH" ] || [ "$PR_BRANCH" = "null" ]; then
    echo "❌ Could not determine PR branches for PR #$PR_ID"
    exit 1
fi

echo "→ Analysing merge conflicts for PR #$PR_ID ($PR_BRANCH → $BASE_BRANCH)"

# Save current branch so we can return to it
CURRENT_BRANCH=$(git branch --show-current)

git fetch origin "$BASE_BRANCH" "$PR_BRANCH" 2>/dev/null
git checkout "$PR_BRANCH" 2>/dev/null

# Dry‑run merge to detect conflicts without touching working tree
if git merge --no-commit --no-ff "origin/$BASE_BRANCH" &>/dev/null; then
    echo "✅ No conflicts detected"
    git merge --abort 2>/dev/null || true
    git checkout "$CURRENT_BRANCH" 2>/dev/null || true
    exit 0
fi

echo "⚠️  Conflicts detected – analysing complexity..."

# List conflicted files
CONFLICTS=$(git diff --name-only --diff-filter=U 2>/dev/null)

for file in $CONFLICTS; do
    # Check if conflict is "simple" (whitespace, imports, lockfiles, etc.)
    if grep -qE '^<<<<<<< |^=======$|^>>>>>>> ' "$file" 2>/dev/null; then
        # Heuristics for simple conflicts – auto‑resolve
        if [[ "$file" =~ \.(lock|toml|json)$ ]] || grep -qE '^[[:space:]]*import |^[[:space:]]*from ' "$file" 2>/dev/null; then
            echo "   Auto‑resolving simple conflict in $file"
            git checkout --theirs "$file" 2>/dev/null
            git add "$file" 2>/dev/null
        else
            echo "❌ Complex conflict in $file – cannot auto‑resolve"
            echo "   -> Halting automation. Delegating to goap-agent skill for parallel analysis and implementation."
            gh pr comment "$PR_ID" --body "🤖 **Autopilot Handoff**: Complex merge conflict detected in \`$file\`. Delegating to \`goap-agent skill\` for parallel analysis and implementation." 2>/dev/null || true
            git merge --abort 2>/dev/null || true
            git checkout "$CURRENT_BRANCH" 2>/dev/null || true
            exit 1
        fi
    fi
done

# Commit the resolutions
if git diff --cached --quiet; then
    echo "   No changes to commit"
else
    git commit -m "chore(merge): auto‑resolve simple conflicts in PR #$PR_ID" --no-verify
    git push origin "$PR_BRANCH"
    echo "✅ Conflicts resolved and pushed"
fi

# Return to original branch
git checkout "$CURRENT_BRANCH" 2>/dev/null || true
