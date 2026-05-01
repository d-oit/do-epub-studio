#!/usr/bin/env bash
# Phase 2: COMMIT - Atomic commit creation
# Creates commit with conventional format, auto-detects type if needed
# Only commits already-staged changes (no git add -A).
# Usage: commit.sh ["message"]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"
# shellcheck source=scripts/lib/logging.sh
source "$REPO_ROOT/scripts/lib/logging.sh" commit

cd "$REPO_ROOT"

MESSAGE="${1:-}"

detect_commit_type() {
    local files
    files=$(git diff --cached --name-only 2>/dev/null || true)

    if [[ -z "$files" ]]; then
        echo "chore"
        return
    fi

    if echo "$files" | grep -qE '\.github/workflows|scripts/.*\.sh$'; then
        echo "ci"
        return
    fi

    if echo "$files" | grep -qE 'test|spec|__tests__|\.test\.|\.spec\.'; then
        echo "test"
        return
    fi

    if echo "$files" | grep -qE '\.md$|\.txt$|docs/|agents-docs/|plans/'; then
        echo "docs"
        return
    fi

    if echo "$files" | grep -qE 'refactor|restructure'; then
        echo "refactor"
        return
    fi

    if echo "$files" | grep -qE 'scripts/|\.yml$|\.yaml$'; then
        echo "ci"
        return
    fi

    local added modified
    added=$(git diff --cached --name-status 2>/dev/null | grep -c '^A' || true)
    modified=$(git diff --cached --name-status 2>/dev/null | grep -c '^M' || true)

    if [[ "$added" -gt "$modified" ]]; then
        echo "feat"
    else
        echo "fix"
    fi
}

detect_scope() {
    local branch
    branch=$(git branch --show-current)

    # Extract scope from branch name: type/scope-name → scope
    if [[ "$branch" =~ ^(feat|fix|docs|refactor|test|ci|chore)/(.+)$ ]]; then
        local scope_raw="${BASH_REMATCH[2]}"
        # Use first path component as scope
        echo "$scope_raw" | cut -d'-' -f1
        return
    fi

    # Infer scope from changed files
    local files
    files=$(git diff --cached --name-only 2>/dev/null || true)

    if echo "$files" | grep -qE '^scripts/'; then
        echo "scripts"
        return
    fi

    if echo "$files" | grep -qE '^apps/([^/]+)'; then
        echo "${BASH_REMATCH[1]}"
        return
    fi

    if echo "$files" | grep -qE '^packages/([^/]+)'; then
        echo "${BASH_REMATCH[1]}"
        return
    fi

    echo ""
}

generate_summary() {
    local files
    files=$(git diff --cached --name-only 2>/dev/null || true)
    local count
    count=$(echo "$files" | grep -c . || echo 0)

    if [[ "$count" -eq 0 ]]; then
        echo "no changes"
        return
    fi

    # Group by top-level directory for meaningful summary
    local dirs
    dirs=$(echo "$files" | awk -F/ '{print $1}' | sort -u | tr '\n' ', ' | sed 's/,$//')
    echo "$count file(s) in: $dirs"
}

# Require at least some staged changes
if git diff --cached --quiet 2>/dev/null; then
    error "No staged changes to commit"
    error "Run 'git add <files>' first (this script does NOT auto-stage)"
    exit 1
fi

if [[ -z "$MESSAGE" ]]; then
    COMMIT_TYPE=$(detect_commit_type)
    SCOPE=$(detect_scope)
    SUMMARY=$(generate_summary)

    if [[ -n "$SCOPE" ]]; then
        MESSAGE="$COMMIT_TYPE($SCOPE): $SUMMARY"
    else
        MESSAGE="$COMMIT_TYPE: $SUMMARY"
    fi

    log "Auto-generated message: $MESSAGE"
fi

# Validate conventional commit format
if ! echo "$MESSAGE" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|ci|chore|build)(\([a-z0-9_-]+\))?!?: .+'; then
    error "Invalid commit message format"
    error "Expected: type(scope): description"
    error "Types: feat, fix, docs, style, refactor, perf, test, ci, chore, build"
    error "Got: $MESSAGE"
    exit 1
fi

# Check subject line length
SUBJECT=$(echo "$MESSAGE" | head -1)
if [[ ${#SUBJECT} -gt 72 ]]; then
    error "Commit subject too long (${#SUBJECT} chars, max 72)"
    error "Subject: $SUBJECT"
    exit 1
fi

log "Commit message: $MESSAGE"

# Only commit what's already staged — do NOT run git add -A
if ! git commit -m "$MESSAGE"; then
    error "Commit failed"
    exit 1
fi

COMMIT_SHA=$(git rev-parse HEAD)
success "Created commit: ${COMMIT_SHA:0:8}"
success "Message: $MESSAGE"

exit 0
