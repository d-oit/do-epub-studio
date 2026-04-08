#!/usr/bin/env bash
# Phase 2: COMMIT - Atomic commit creation
# Creates commit with conventional format, auto-detects type if needed
# Usage: commit.sh ["message"]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED='' GREEN='' BLUE='' NC=''
fi

log() {
    echo -e "${BLUE}[commit]${NC} $*"
}

error() {
    echo -e "${RED}[commit]${NC} $*" >&2
}

success() {
    echo -e "${GREEN}[commit]${NC} $*"
}

cd "$REPO_ROOT"

MESSAGE="${1:-}"

detect_commit_type() {
    local files
    files=$(git diff --cached --name-only 2>/dev/null || git status --porcelain | grep '^[AM]' | awk '{print $2}')

    if echo "$files" | grep -qE '\.github/workflows|scripts/|\.yml$|\.yaml$'; then
        echo "ci"
        return
    fi

    if echo "$files" | grep -qE 'test|spec|__tests__'; then
        echo "test"
        return
    fi

    if echo "$files" | grep -qE '\.md$|\.txt$|docs/'; then
        echo "docs"
        return
    fi

    if echo "$files" | grep -qE 'refactor|restructure'; then
        echo "refactor"
        return
    fi

    local added modified
    added=$(git status --porcelain | grep -c '^A' || true)
    modified=$(git status --porcelain | grep -c '^M' || true)

    if [[ "$added" -gt "$modified" ]]; then
        echo "feat"
    else
        echo "fix"
    fi
}

detect_scope() {
    local branch
    branch=$(git branch --show-current)

    if [[ "$branch" =~ ^(feat|fix|docs|refactor|test|ci)/(.+)$ ]]; then
        echo "${BASH_REMATCH[2]}" | cut -d'-' -f1
        return
    fi

    echo ""
}

if [[ -z "$MESSAGE" ]]; then
    COMMIT_TYPE=$(detect_commit_type)
    SCOPE=$(detect_scope)

    CHANGED_FILES=$(git status --porcelain | grep '^[AM]' | awk '{print $2}' | head -3 | tr '\n' ', ' | sed 's/,$//')

    if [[ -n "$SCOPE" ]]; then
        MESSAGE="$COMMIT_TYPE($SCOPE): update $CHANGED_FILES"
    else
        MESSAGE="$COMMIT_TYPE: update $CHANGED_FILES"
    fi

    log "Auto-generated message: $MESSAGE"
fi

if ! echo "$MESSAGE" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|ci|chore)(\([a-z0-9-]+\))?: .+'; then
    error "Invalid commit message format"
    error "Expected: type(scope): description"
    error "Types: feat, fix, docs, style, refactor, perf, test, ci, chore"
    error "Got: $MESSAGE"
    exit 1
fi

SUBJECT=$(echo "$MESSAGE" | head -1)
if [[ ${#SUBJECT} -gt 72 ]]; then
    error "Commit subject too long (${#SUBJECT} chars, max 72)"
    error "Subject: $SUBJECT"
    exit 1
fi

log "Commit message: $MESSAGE"

git add -A

if git diff --cached --quiet; then
    error "No changes to commit"
    exit 1
fi

if ! git commit -m "$MESSAGE"; then
    error "Commit failed"
    exit 1
fi

COMMIT_SHA=$(git rev-parse HEAD)
success "Created commit: ${COMMIT_SHA:0:8}"
success "Message: $MESSAGE"

exit 0