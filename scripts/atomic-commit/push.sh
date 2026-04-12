#!/usr/bin/env bash
# Phase 3 & 4: PRE_PUSH and PUSH - Remote sync and upload
# Checks remote sync status, handles rebasing, pushes to origin
# Usage: push.sh [--check-only]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CHECK_ONLY=false
if [[ "${1:-}" == "--check-only" ]]; then
    CHECK_ONLY=true
fi

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"
# shellcheck source=scripts/lib/logging.sh
source "$REPO_ROOT/scripts/lib/logging.sh" push

cd "$REPO_ROOT"

CURRENT_BRANCH=$(git branch --show-current)
BASE_BRANCH="${ATOMIC_COMMIT_BASE_BRANCH:-main}"

# Track temp branches for cleanup on exit/interrupt
TEMP_BRANCHES=()

cleanup_temp_branches() {
    for tb in "${TEMP_BRANCHES[@]}"; do
        git branch -D "$tb" 2>/dev/null || true
    done
}

trap cleanup_temp_branches EXIT INT TERM

log "Branch: $CURRENT_BRANCH"
log "Base branch: $BASE_BRANCH"

log "Fetching from origin..."
if ! git fetch origin "$BASE_BRANCH" 2>/dev/null && ! git fetch origin 2>/dev/null; then
    error "Failed to fetch from origin"
    error "Check network connection and remote URL"
    exit 1
fi

# Determine actual base branch
if ! git show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH" 2>/dev/null; then
    if git show-ref --verify --quiet refs/remotes/origin/main 2>/dev/null; then
        BASE_BRANCH="main"
    elif git show-ref --verify --quiet refs/remotes/origin/master 2>/dev/null; then
        BASE_BRANCH="master"
    else
        error "Cannot determine base branch"
        error "Set ATOMIC_COMMIT_BASE_BRANCH or ensure origin/main exists"
        exit 1
    fi
fi

log "Using base branch: origin/$BASE_BRANCH"

log "Checking branch sync status..."

MERGE_BASE=$(git merge-base "origin/$BASE_BRANCH" HEAD 2>/dev/null || true)
ORIGIN_BASE_SHA=$(git rev-parse "origin/$BASE_BRANCH" 2>/dev/null || true)

if [[ -z "$MERGE_BASE" ]] || [[ -z "$ORIGIN_BASE_SHA" ]]; then
    error "Failed to determine merge base"
    exit 1
fi

if [[ "$MERGE_BASE" != "$ORIGIN_BASE_SHA" ]]; then
    warn "Local branch is behind origin/$BASE_BRANCH"
    warn "Remote has new commits that need to be incorporated"

    log "Checking for potential conflicts..."

    TEMP_BRANCH="temp-rebase-check-$$"
    TEMP_BRANCHES+=("$TEMP_BRANCH")
    git branch "$TEMP_BRANCH" HEAD

    if ! git rebase "origin/$BASE_BRANCH" "$TEMP_BRANCH" >/dev/null 2>&1; then
        error "Rebase would have conflicts"
        error "Resolve manually: git pull --rebase origin $BASE_BRANCH"
        git rebase --abort 2>/dev/null || true
        exit 1
    fi

    # Cleanup temp branch (also handled by trap)
    git branch -D "$TEMP_BRANCH" 2>/dev/null || true
    TEMP_BRANCHES=("${TEMP_BRANCHES[@]/$TEMP_BRANCH}")

    log "Rebasing onto origin/$BASE_BRANCH..."
    if ! git rebase "origin/$BASE_BRANCH"; then
        error "Rebase failed"
        error "Resolve conflicts and run: git rebase --continue"
        exit 1
    fi

    success "Rebased successfully"
fi

if git show-ref --verify --quiet "refs/remotes/origin/$CURRENT_BRANCH" 2>/dev/null; then
    if ! git merge-base --is-ancestor "origin/$CURRENT_BRANCH" HEAD 2>/dev/null; then
        warn "Remote branch has diverged from local"
        warn "Remote will be force-updated"
    fi
fi

if [[ "$CHECK_ONLY" == true ]]; then
    success "Pre-push checks passed"
    exit 0
fi

log "Pushing to origin/$CURRENT_BRANCH..."

if ! git push -u origin "$CURRENT_BRANCH" 2>&1; then
    error "Push failed"
    error "Check remote permissions and network connection"
    exit 1
fi

LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse "origin/$CURRENT_BRANCH" 2>/dev/null || echo "")

if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
    error "Push verification failed"
    error "Local SHA: ${LOCAL_SHA:0:8}"
    error "Remote SHA: ${REMOTE_SHA:0:8}"
    exit 1
fi

success "Pushed successfully: ${LOCAL_SHA:0:8}"

exit 0
