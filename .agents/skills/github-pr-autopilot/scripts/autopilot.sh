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

# Verify auth and switch account if needed
if [ -f "$SCRIPT_DIR/verify-auth.sh" ]; then
    bash "$SCRIPT_DIR/verify-auth.sh"
fi

# Check PR labels for protected ones before proceeding
echo "→ Checking PR labels..."
gh pr view "$PR_ID" --json labels --jq '.labels[].name' 2>/dev/null | while IFS= read -r label; do
    [ -z "$label" ] && continue
    case "$label" in
        release|release:cut|WIP|"DO NOT MERGE")
            echo "❌ PR has protected label '$label' – cannot auto‑merge"
            exit 2
            ;;
    esac
done

if [ $? -eq 2 ]; then exit 1; fi

# Check if PR touches auth/security files
echo "→ Checking for sensitive file changes..."
gh pr view "$PR_ID" --json files --jq '.files[].path' 2>/dev/null | while IFS= read -r file; do
    [ -z "$file" ] && continue
    # Skip sensitive check for the autopilot skill's own directory, CLI skill mappings, and plans
    if [[ "$file" == .agents/skills/github-pr-autopilot/* ]] || \
       [[ "$file" == .qwen/skills* ]] || \
       [[ "$file" == .claude/skills* ]] || \
       [[ "$file" == .gemini/skills* ]] || \
       [[ "$file" == docs/plans/* ]]; then
        continue
    fi
    if echo "$file" | grep -qiE "(auth|security|permission|argon2|session|token|secret)"; then
        echo "❌ PR touches sensitive files ($file) – requires human review"
        exit 2
    fi
done

if [ $? -eq 2 ]; then exit 1; fi

# ——————————————————————————————
# Comprehensive pre-analysis before entering main loop
# ——————————————————————————————

echo ""
echo "📊 Comprehensive pre-analysis for PR #$PR_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Gather ALL feedback types in parallel
PRE_ANALYSIS=$(gh api "repos/{owner}/{repo}/pulls/$PR_ID/comments" --jq 'length' 2>/dev/null || echo "0")
PRE_ISSUES=$(gh api "repos/{owner}/{repo}/issues/$PR_ID/comments" --jq '[.[] | select(.user.login != "d-oit" and .user.login != "cloudflare-workers-and-pages" and .user.login != "github-actions")] | length' 2>/dev/null || echo "0")
PRE_REVIEWS=$(gh pr view "$PR_ID" --json reviews --jq '.reviews | length' 2>/dev/null || echo "0")
PRE_CI=$(gh pr view "$PR_ID" --json statusCheckRollup --jq '[.statusCheckRollup[]? | select(.status != "SUCCESS")] | length' 2>/dev/null || echo "0")
PRE_FILES=$(gh pr view "$PR_ID" --json files --jq '[.files[].path] | length' 2>/dev/null || echo "0")
PRE_CONFLICT=$(gh pr view "$PR_ID" --json mergeable --jq '.mergeable' 2>/dev/null || echo "UNKNOWN")

echo "  Files changed:   $PRE_FILES"
echo "  Mergeable:       $PRE_CONFLICT"
echo "  Inline comments: $PRE_ANALYSIS"
echo "  Issue comments:  $PRE_ISSUES"
echo "  Formal reviews:  $PRE_REVIEWS"
echo "  Failing CI:      $PRE_CI"
echo ""

# Check all blocking conditions
# shellcheck disable=SC2034
BLOCKED=false
if [ "$PRE_CONFLICT" = "CONFLICTING" ]; then
    echo "  ⚠️  Merge conflicts detected (will resolve in-loop)"
fi
if [ "$PRE_CI" -gt 0 ] 2>/dev/null; then
    echo "  ⚠️  $PRE_CI CI checks not passing (will wait in-loop)"
fi
if [ "$PRE_ANALYSIS" -gt 0 ] || [ "$PRE_ISSUES" -gt 0 ] || [ "$PRE_REVIEWS" -gt 0 ]; then
    echo "  📝 Feedback found across $(($PRE_ANALYSIS + $PRE_ISSUES + $PRE_REVIEWS)) items ($PRE_ANALYSIS inline + $PRE_ISSUES issue + $PRE_REVIEWS review)"
    echo "     Will process comments in-loop"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

while [ $ITER -lt $MAX_ITER ]; do
    ITER=$((ITER + 1))
    echo ""
    echo "📡 Iteration $ITER/$MAX_ITER"

    # Fetch PR state
    STATE=$(gh pr view "$PR_ID" --json mergeable,reviewDecision,statusCheckRollup,reviews 2>/dev/null)
    MERGEABLE=$(echo "$STATE" | jq -r '.mergeable // "UNKNOWN"')
    REVIEW=$(echo "$STATE" | jq -r '.reviewDecision // "NONE"')
    REVIEW_CNT=$(echo "$STATE" | jq '[.reviews[]?] | length' 2>/dev/null || echo "0")
    CI_FAILING=$(echo "$STATE" | jq '[.statusCheckRollup[]? | select(.status != "SUCCESS" and .name != "Lighthouse audit" and .name != "Auto-merge minor/patch updates")] | length' 2>/dev/null || echo "0")

    echo "   Mergeable: $MERGEABLE"
    echo "   Review:    $REVIEW ($REVIEW_CNT reviews)"

    # Resolve conflicts if any
    if [ "$MERGEABLE" = "CONFLICTING" ] || [ "$MERGEABLE" = "UNKNOWN" ]; then
        echo "⚠️  Merge conflicts detected – running conflict resolver..."
        if bash "$SCRIPT_DIR/resolve-conflicts.sh" "$PR_ID"; then
            echo "   Conflicts resolved. Waiting for CI to re‑evaluate..."
            sleep 10
            continue
        else
            echo "❌ Conflict resolution failed – delegating to goap-agent skill for parallel analysis and implementation"
            exit 1
        fi
    fi

    # Process comments if not approved
    if [ "$REVIEW" != "APPROVED" ] && [ "$REVIEW" != "NONE" ]; then
        echo "📝 PR has pending review – processing comments..."
        # process-comments.sh returns 2 if it handled/acknowledged comments but didn't fix them all
        # it returns 0 if all comments are handled/skipped
        if bash "$SCRIPT_DIR/process-comments.sh" "$PR_ID"; then
            echo "   All current comments acknowledged or resolved."
        else
            echo "❌ Must‑fix comments found – delegating to goap-agent skill for parallel analysis and implementation"
            exit 1
        fi
    fi

    # Wait for passing CI checks (ignore known non-blocking failures)
    TOTAL=$(echo "$STATE" | jq '[.statusCheckRollup[]?] | length' 2>/dev/null || echo "0")
    if [ "$CI_FAILING" -gt 0 ] 2>/dev/null; then
        echo "⏳ CI checks: $CI_FAILING/$TOTAL not passing (ignoring non‑blocking) – waiting..."
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
