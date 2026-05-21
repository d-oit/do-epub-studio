#!/bin/bash
set -euo pipefail

echo "→ Verifying GitHub authentication..."

# Check if gh is authenticated
if ! gh auth status &>/dev/null; then
    echo "❌ GitHub CLI not authenticated. Please run: gh auth login"
    exit 1
fi

# Get repository owner from the current repo
REPO_OWNER=$(gh repo view --json owner --jq '.owner.login' 2>/dev/null)
if [ -z "$REPO_OWNER" ]; then
    echo "❌ Could not determine repository owner. Are you inside a git repo?"
    exit 1
fi
echo "   Repository owner: $REPO_OWNER"

# Get the currently active GitHub account
ACTIVE_ACCOUNT=$(gh api user --jq '.login' 2>/dev/null)
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo "❌ Could not determine active GitHub account"
    exit 1
fi
echo "   Active account:   $ACTIVE_ACCOUNT"

# Compare and switch if needed
if [ "$ACTIVE_ACCOUNT" != "$REPO_OWNER" ]; then
    echo "⚠️  Account mismatch – active ($ACTIVE_ACCOUNT) != repo owner ($REPO_OWNER)"
    echo "   Switching to $REPO_OWNER ..."
    if gh auth switch --user "$REPO_OWNER" &>/dev/null; then
        NEW_ACCOUNT=$(gh api user --jq '.login' 2>/dev/null)
        if [ "$NEW_ACCOUNT" != "$REPO_OWNER" ]; then
            echo "❌ Switch failed – still active: $NEW_ACCOUNT"
            exit 1
        fi
        echo "✅ Switched to $REPO_OWNER"
    else
        echo "❌ Could not switch to $REPO_OWNER. Run manually: gh auth switch --user $REPO_OWNER"
        exit 1
    fi
else
    echo "✅ Account verification passed"
fi
