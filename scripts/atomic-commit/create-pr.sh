#!/usr/bin/env bash
# Phase 5: PR_CREATE - Create pull request
# Creates PR with proper title, body, and base branch
# Usage: create-pr.sh [base-branch]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BASE_BRANCH="${1:-main}"

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"
# shellcheck source=scripts/lib/logging.sh
source "$REPO_ROOT/scripts/lib/logging.sh" pr-create

cd "$REPO_ROOT"

CURRENT_BRANCH=$(git branch --show-current)
COMMIT_SUBJECT=$(git log -1 --pretty=%s)

log "Creating PR for branch: $CURRENT_BRANCH"
log "Base branch: $BASE_BRANCH"

generate_pr_body() {
    local file_list
    file_list=$(git diff --name-only "origin/$BASE_BRANCH..HEAD" 2>/dev/null | head -20 | sed 's/^/- /' || echo "- (no changes detected)")

    local commit_type
    commit_type=$(echo "$COMMIT_SUBJECT" | grep -oE '^(feat|fix|docs|style|refactor|perf|test|ci|chore|build)' || echo "other")

    cat << EOF
## Summary

$COMMIT_SUBJECT

## Changes

$(git log --oneline "origin/$BASE_BRANCH..HEAD" 2>/dev/null | sed 's/^/- /' || echo "- Initial commit")

## Files Changed

$file_list

## Type

$commit_type

## Checklist

- [x] Quality gate passed
- [x] All tests pass
- [x] No secrets in code
- [x] Conventional commit format

## Related

<!-- Link related issues: Fixes #123, Closes #456 -->

EOF
}

EXISTING_PR=$(gh pr list --head "$CURRENT_BRANCH" --json number --jq '.[0].number' 2>/dev/null || echo "")

if [[ -n "$EXISTING_PR" ]]; then
    log "PR already exists for this branch: #$EXISTING_PR"
    success "Using existing PR"
    exit 0
fi

log "Creating new pull request..."

PR_BODY=$(generate_pr_body)

if ! PR_URL=$(gh pr create \
    --title "$COMMIT_SUBJECT" \
    --body "$PR_BODY" \
    --base "$BASE_BRANCH" 2>&1); then

    error "Failed to create PR"
    error "$PR_URL"
    exit 1
fi

PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$' || echo "")

if [[ -z "$PR_NUMBER" ]]; then
    PR_NUMBER=$(gh pr view --json number --jq '.number' 2>/dev/null || echo "")
fi

success "Created PR #$PR_NUMBER"
success "URL: $PR_URL"

exit 0
