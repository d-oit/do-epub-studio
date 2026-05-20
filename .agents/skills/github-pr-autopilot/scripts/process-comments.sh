#!/bin/bash
# Usage: process-comments.sh <PR_NUMBER>
set -euo pipefail

PR_ID="${1:-}"
if [ -z "$PR_ID" ]; then
    echo "❌ Usage: process-comments.sh <PR_NUMBER>"
    exit 1
fi

echo "→ Fetching unresolved review comments for PR #$PR_ID"

# Fetch all comments and reviews
# Corrected syntax for GH CLI 2.x interpolation
COMMENTS=$(gh api "repos/:owner/:repo/pulls/$PR_ID/comments" --jq '.[] | select(.position != null)' 2>/dev/null)

if [ -z "$COMMENTS" ]; then
    echo "✅ No unresolved comments found"
    exit 0
fi

HAS_MUST_FIX=false

# Use process substitution and while-read to handle potential spaces or multi-line comments
while IFS= read -r comment; do
    [ -z "$comment" ] && continue
    
    ID=$(echo "$comment" | jq -r '.id')
    BODY=$(echo "$comment" | jq -r '.body')
    PATH_FILE=$(echo "$comment" | jq -r '.path')
    LINE=$(echo "$comment" | jq -r '.line // "unknown"')
    REACTIONS=$(echo "$comment" | jq -r '.reactions.total_count // 0')

    # Skip if we've already acknowledged this comment (look for 👀 reaction)
    # Note: Checking for specific reactions requires another API call per comment or better jq.
    # For simplicity, if total reactions > 0, we'll assume it's being handled.
    if [ "$REACTIONS" -gt 0 ]; then
        echo "   → Already acknowledged comment on $PATH_FILE:$LINE - skipping"
        continue
    fi

    # Classify comment by keywords
    if echo "$BODY" | grep -qiE "must|fix|required|bug|error"; then
        echo "⚠️  Must‑fix comment on $PATH_FILE:$LINE: $BODY"
        echo "   -> Halting automation. Delegating to goap-agent skill for parallel analysis and implementation."
        gh pr comment "$PR_ID" --body "🤖 **Autopilot Handoff**: Must‑fix comments found. Delegating to \`goap-agent skill\` for parallel analysis and implementation." 2>/dev/null || true
        # Add 👀 reaction to the comment to mark it as 'triaged'
        gh api -X POST "repos/:owner/:repo/pulls/comments/$ID/reactions" -f "content=eyes" 2>/dev/null || true
        HAS_MUST_FIX=true
        continue
    elif echo "$BODY" | grep -qiE "suggest|consider|maybe|nit|should"; then
        echo "   → Should‑fix (needs review): $BODY"
        echo "   → Replying with acknowledgment"
        gh pr comment "$PR_ID" --body "Thanks for the feedback! I've noted your suggestion on \`$PATH_FILE\` and will address it shortly." 2>/dev/null || true
        # Add 👀 reaction
        gh api -X POST "repos/:owner/:repo/pulls/comments/$ID/reactions" -f "content=eyes" 2>/dev/null || true
    else
        echo "   → Discussion/ack – replying politely"
        gh pr comment "$PR_ID" --body "Thanks for the feedback! I've noted your comment and will address it in a follow‑up." 2>/dev/null || true
        # Add 👀 reaction
        gh api -X POST "repos/:owner/:repo/pulls/comments/$ID/reactions" -f "content=eyes" 2>/dev/null || true
    fi
done < <(echo "$COMMENTS")

if [ "$HAS_MUST_FIX" = true ]; then
    echo "❌ Must‑fix comments found – delegating to goap-agent skill"
    exit 1
fi

echo "✅ Comment processing completed"
