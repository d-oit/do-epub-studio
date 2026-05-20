#!/bin/bash
# Usage: autopilot.sh <PR_NUMBER>
set -euo pipefail

PR_ID="${1:-}"
if [ -z "$PR_ID" ]; then
    echo "❌ Usage: autopilot.sh <PR_NUMBER>"
    exit 1
fi

MAX_ITER=10
ITER=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting GitHub PR Autopilot for PR #$PR_ID"

# Check PR labels for protected ones before proceeding
echo "→ Checking PR labels..."
LABELS=$(gh pr view "$PR_ID" --json labels --jq '.labels[].name' 2>/dev/null)
for label in $LABELS; do
    case "$label" in
        release|release:cut|WIP|"DO NOT MERGE")
            echo "❌ PR has protected label '$label' – cannot auto‑merge"
            exit 1
            ;;
    esac
done

# Check if PR touches auth/security files
echo "→ Checking for sensitive file changes..."
PR_FILES=$(gh pr view "$PR_ID" --json files --jq '.files[].path' 2>/dev/null)
for file in $PR_FILES; do
    if echo "$file" | grep -qiE "(auth|security|permission|argon2|session|token|secret)"; then
        echo "❌ PR touches sensitive files ($file) – requires human review"
        exit 1
    fi
done

while [ $ITER -lt $MAX_ITER ]; do
    ITER=$((ITER + 1))
    echo ""
    echo "📡 Iteration $ITER/$MAX_ITER"

    # Fetch PR state
    STATE=$(gh pr view "$PR_ID" --json mergeable,reviewDecision,statusCheckRollup 2>/dev/null)
    MERGEABLE=$(echo "$STATE" | jq -r '.mergeable // "UNKNOWN"')
    REVIEW=$(echo "$STATE" | jq -r '.reviewDecision // "NONE"')

    echo "   Mergeable: $MERGEABLE"
    echo "   Review:    $REVIEW"

    # Resolve conflicts if any
    if [ "$MERGEABLE" = "CONFLICTING" ] || [ "$MERGEABLE" = "UNKNOWN" ]; then
        echo "⚠️  Merge conflicts detected – running conflict resolver..."
        if bash "$SCRIPT_DIR/resolve-conflicts.sh" "$PR_ID"; then
            echo "   Conflicts resolved. Waiting for CI to re‑evaluate..."
            sleep 10
            continue
        else
            echo "❌ Conflict resolution failed – requires human intervention"
            exit 1
        fi
    fi

    # Process comments if not approved
    if [ "$REVIEW" != "APPROVED" ] && [ "$REVIEW" != "NONE" ]; then
        echo "📝 PR has pending review – processing comments..."
        if bash "$SCRIPT_DIR/process-comments.sh" "$PR_ID"; then
            echo "   Comments processed. Waiting for reviewer response..."
            sleep 30
            continue
        else
            echo "❌ Must‑fix comments found – requires human intervention"
            exit 1
        fi
    fi

    # Wait for passing CI checks
    FAILING=$(echo "$STATE" | jq '[.statusCheckRollup[]? | select(.status != "SUCCESS")] | length' 2>/dev/null || echo "0")
    TOTAL=$(echo "$STATE" | jq '[.statusCheckRollup[]?] | length' 2>/dev/null || echo "0")
    if [ "$FAILING" -gt 0 ] 2>/dev/null; then
        echo "⏳ CI checks: $FAILING/$TOTAL not passing – waiting..."
        sleep 30
        continue
    fi

    # All conditions met – merge!
    echo ""
    echo "✅ PR #$PR_ID is ready to merge:"
    echo "   - Approved (or no review required)"
    echo "   - Conflict‑free"
    echo "   - All CI checks passing"
    echo ""
    echo "   Merging with --squash --delete-branch..."
    gh pr merge "$PR_ID" --squash --delete-branch --auto
    echo ""
    echo "🎉 PR #$PR_ID has been merged (or added to the merge queue)"
    exit 0
done

echo ""
echo "❌ Max iterations ($MAX_ITER) reached without merging. Please investigate manually."
exit 1
