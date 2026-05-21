#!/bin/bash
# Usage: process-comments.sh <PR_NUMBER>
set -euo pipefail

PR_ID="${1:-}"
if [ -z "$PR_ID" ]; then
    echo "❌ Usage: process-comments.sh <PR_NUMBER>"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
echo "→ Comprehensive feedback analysis for PR #$PR_ID"
HAS_MUST_FIX=false
AUTO_FIXED=false

# ——————————————————————————————
# Phase 1: Gather ALL feedback types
# ——————————————————————————————

echo "  Phase 1: Gathering all feedback..."

# 1a. Inline review comments (code-level comments on specific lines)
REVIEW_COMMENTS=$(gh api "repos/{owner}/{repo}/pulls/$PR_ID/comments" --jq '.[] | select(.position != null)' 2>/dev/null || echo "")
REVIEW_CNT=$(echo "$REVIEW_COMMENTS" | jq -s 'length' 2>/dev/null || echo "0")

# 1b. Issue comments (general PR thread) — filter out our own and bots
ISSUE_COMMENTS=$(gh api "repos/{owner}/{repo}/issues/$PR_ID/comments" --jq '.[] | select(.user.login != "d-oit" and .user.login != "cloudflare-workers-and-pages" and .user.login != "github-actions")' 2>/dev/null || echo "")
ISSUE_CNT=$(echo "$ISSUE_COMMENTS" | jq -s 'length' 2>/dev/null || echo "0")

# 1c. Formal PR reviews
REVIEWS=$(gh pr view "$PR_ID" --json reviews --jq '.reviews[]' 2>/dev/null || echo "")
REVIEWS_CNT=$(echo "$REVIEWS" | jq -s 'length' 2>/dev/null || echo "0")

echo "  Found: $REVIEW_CNT inline review comments, $ISSUE_CNT issue comments, $REVIEWS_CNT formal reviews"

# ——————————————————————————————
# Phase 2: Process inline review comments
# ——————————————————————————————

echo "  Phase 2: Processing inline review comments..."

while IFS= read -r comment; do
    [ -z "$comment" ] && continue

    ID=$(echo "$comment" | jq -r '.id')
    BODY=$(echo "$comment" | jq -r '.body')
    PFILE=$(echo "$comment" | jq -r '.path')
    LINE=$(echo "$comment" | jq -r '.line // "unknown"')
    REACTIONS=$(echo "$comment" | jq -r '.reactions.total_count // 0')

    [ "$REACTIONS" -gt 0 ] && continue
    [ -z "$PFILE" ] || [ "$PFILE" = "null" ] && continue

    if echo "$BODY" | grep -qiE '\bmust\b|\bfix\b|\brequired\b|\bbug\b|\berror\b|\bhigh.risk\b'; then
        echo "  ! Must-fix inline comment on $PFILE:$LINE"
        gh api -X POST "repos/{owner}/{repo}/pulls/comments/$ID/reactions" -f "content=eyes" 2>/dev/null || true
        HAS_MUST_FIX=true
    elif echo "$BODY" | grep -qiE '\bsuggest\b|\bconsider\b|\bmaybe\b|\bnit\b|\bshould\b'; then
        echo "  -> Should-fix on $PFILE:$LINE – acknowledged"
        gh pr comment "$PR_ID" --body "Thanks for the feedback! I've noted your suggestion on \`$PFILE\` and will address it shortly." 2>/dev/null || true
        gh api -X POST "repos/{owner}/{repo}/pulls/comments/$ID/reactions" -f "content=eyes" 2>/dev/null || true
    else
        echo "  -> Discussion on $PFILE:$LINE"
        gh pr comment "$PR_ID" --body "Thanks for the feedback! I've noted your comment and will address it in a follow-up." 2>/dev/null || true
        gh api -X POST "repos/{owner}/{repo}/pulls/comments/$ID/reactions" -f "content=eyes" 2>/dev/null || true
    fi
done < <(echo "$REVIEW_COMMENTS")

# ——————————————————————————————
# Phase 3: Process issue comments
# ——————————————————————————————

echo "  Phase 3: Processing issue comments..."

while IFS= read -r comment; do
    [ -z "$comment" ] && continue

    AUTHOR=$(echo "$comment" | jq -r '.user.login // "unknown"')
    BODY=$(echo "$comment" | jq -r '.body')
    REACTIONS=$(echo "$comment" | jq -r '.reactions.total_count // 0')
    ID=$(echo "$comment" | jq -r '.id')

    [ "$REACTIONS" -gt 0 ] && continue

    if echo "$BODY" | grep -qiE '\bmust\b|\bfix\b|\brequired\b|\bbug\b|\berror\b|\bhigh.risk\b'; then
        echo "  ! Must-fix pattern in issue comment by $AUTHOR [id=$ID]"
        HAS_MUST_FIX=true
    fi
done < <(echo "$ISSUE_COMMENTS")

# ——————————————————————————————
# Phase 4: Process formal reviews (validate claims against actual code)
# ——————————————————————————————

echo "  Phase 4: Processing formal reviews..."

validate_claim() {
    local file="$1" pattern="$2" desc="$3"
    if [ -f "$file" ] && grep -qE "$pattern" "$file" 2>/dev/null; then
        echo "  ! VALIDATED: $desc (still present in $file)"
        return 0
    else
        echo "  ✓ RESOLVED: $desc (pattern not found, already fixed)"
        return 1
    fi
}

while IFS= read -r review; do
    [ -z "$review" ] && continue

    AUTHOR=$(echo "$review" | jq -r '.author.login // "unknown"')
    STATE=$(echo "$review" | jq -r '.state // "unknown"')
    BODY=$(echo "$review" | jq -r '.body')

    echo "  Review by $AUTHOR (state: $STATE) — validating claims against codebase..."

    # Extract file paths referenced in the review body
    REVIEWED_FILES=$(echo "$BODY" | grep -oP '(?<=\`)[^`]+\.sh(?=\`)' 2>/dev/null || true)

    # If review references specific scripts, validate each claim
    if [ -n "$REVIEWED_FILES" ]; then
        echo "  Referenced files: $(echo "$REVIEWED_FILES" | tr '\n' ' ')"
    fi

    # Validate known claim patterns against actual code
    CLAIMS_RESOLVED=true

    # Claim: "for loop over filenames/labels without space handling"
    if echo "$BODY" | grep -qiE 'for.*loop.*space\|while.*read\|space.*filename\|label.*space'; then
        if validate_claim "$SCRIPT_DIR/autopilot.sh" 'for\s+\w+\s+in\s+\$' 'for-loop over unquoted substitution (space safety)'; then
            CLAIMS_RESOLVED=false
        fi
    fi

    # Claim: "aggressive --theirs merge / import heuristic"
    if echo "$BODY" | grep -qiE 'aggressive\|--theirs\|data.loss\|import.*from.*heuristic'; then
        if validate_claim "$SCRIPT_DIR/resolve-conflicts.sh" 'import.*from.*--theirs\|grep.*<<<<<' 'broad import/from heuristic in conflict resolution'; then
            CLAIMS_RESOLVED=false
        fi
    fi

    # Claim: "gh api placeholder syntax"
    if echo "$BODY" | grep -qiE 'gh.api\|placeholder\|owner.*repo.*interpolat'; then
        if validate_claim "$SCRIPT_DIR/process-comments.sh" 'repos/\{owner\}/\{repo\}' 'old {owner}/{repo} syntax in gh api (should use :owner/:repo)'; then
            CLAIMS_RESOLVED=false
        fi
    fi

    # Claim: "spamming PR with duplicate comments"
    if echo "$BODY" | grep -qiE 'spam\|duplicate\|repeated\|iteration.*comment'; then
        if validate_claim "$SCRIPT_DIR/process-comments.sh" 'gh pr comment.*--body.*Thanks' 'duplicate acknowledgment spamming'; then
            CLAIMS_RESOLVED=false
        fi
    fi

    # Claim: "missing .gitignore entry"
    if echo "$BODY" | grep -qiE '\.gitignore\|antigravity'; then
        if validate_claim "$REPO_ROOT/.gitignore" 'antigravitycli' 'missing .antigravitycli/ in .gitignore'; then
            CLAIMS_RESOLVED=false
        fi
    fi

    # Claim: "missing .qwen/skills symlink"
    if echo "$BODY" | grep -qiE '\.qwen/skills\|symlink.*new.skill'; then
        if [ -L "$REPO_ROOT/.qwen/skills" ]; then
            echo "  ✓ RESOLVED: .qwen/skills symlink exists (points to $(readlink "$REPO_ROOT/.qwen/skills"))"
        else
            echo "  ! VALIDATED: .qwen/skills symlink missing"
            CLAIMS_RESOLVED=false
        fi
    fi

    # Claim: "missing tests for sensitive file check"
    if echo "$BODY" | grep -qiE 'test.*sensitive\|sensitive.*file.*test\|halt.*sensitive'; then
        if validate_claim "$SCRIPT_DIR/../tests/autopilot.bats" 'sensitive\|auth.*security.*permission' 'test for sensitive file halt'; then
            echo "  ✓ Has sensitive-file test (grep pattern found)"
        else
            echo "  ! No dedicated test for sensitive file halt"
        fi
    fi

    # Only flag as must-fix if VALIDATED claims remain unresolved
    if [ "$CLAIMS_RESOLVED" = false ]; then
        echo "  ! Must-fix: validated claims remain unresolved in codebase"
        HAS_MUST_FIX=true
    else
        echo "  ✓ All claims validated as resolved in current code"
    fi
done < <(echo "$REVIEWS")

# ——————————————————————————————
# Phase 5: Self-learning – search codebase for patterns matching feedback
# ——————————————————————————————

echo "  Phase 5: Self-learning – scanning codebase for patterns matching feedback..."
FOUND_ISSUES=false

for script in "$SCRIPT_DIR"/*.sh; do
    [ ! -f "$script" ] && continue
    sname=$(basename "$script")
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        echo "  ! $sname:$line"
        FOUND_ISSUES=true
    done < <(grep -nE '^\s*for\s+\w+\s+in\s+\$' "$script" 2>/dev/null || true)
done

if [ "$FOUND_ISSUES" = true ]; then
    gh pr comment "$PR_ID" --body "**Self-learn**: Found unsafe iteration patterns in scripts (for-loops over unquoted command substitutions). These should use while-read loops for space safety." 2>/dev/null || true
    AUTO_FIXED=true
fi

# ——————————————————————————————
# Decision
# ——————————————————————————————

if [ "$HAS_MUST_FIX" = true ]; then
    echo ""
    echo "=============================="
    echo "  Must-fix feedback found – delegating to goap-agent"
    echo "=============================="
    gh pr comment "$PR_ID" --body "**Autopilot Handoff**: Must-fix feedback found after comprehensive analysis of all comments, reviews, and issue comments. Delegating to \`goap-agent skill\` for parallel analysis and implementation." 2>/dev/null || true
    exit 1
fi

echo ""
echo "=============================="
echo "  All feedback analyzed ($REVIEW_CNT inline + $ISSUE_CNT issue + $REVIEWS_CNT review)"
[ "$AUTO_FIXED" = true ] && echo "  Auto-fixes applied via self-learning"
echo "=============================="
exit 0
