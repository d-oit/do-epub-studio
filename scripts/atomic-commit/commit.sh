#!/usr/bin/env bash
# Phase 2: COMMIT - Atomic commit creation
# Creates commit with conventional format and required body, auto-detects type if needed
# Only commits already-staged changes (no git add -A).
# Usage: commit.sh --message "type(scope): description" --body "Why this change matters"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"
# shellcheck source=scripts/lib/logging.sh
source "$REPO_ROOT/scripts/lib/logging.sh" commit
# shellcheck source=scripts/lib/commit-types.sh
source "$REPO_ROOT/scripts/lib/commit-types.sh"

cd "$REPO_ROOT"

function usage() {
    cat <<'EOF'
Usage: commit.sh --message "type(scope): description" --body "Why this change matters"

Required:
  --message, -m  Conventional commit subject, e.g. "fix(security): harden sanitizer"
  --body, -b     One or more lines explaining WHY this change is needed

Examples:
  commit.sh --message "fix(security): harden sanitizer" --body "Codacy flags raw HTML test variables as DOM XSS sinks."
  commit.sh --message "ci(workflows): add path filters" --body "Skip heavy jobs for docs-only PRs."
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# Parse arguments with proper flag handling (order-independent)
MESSAGE=""
BODY=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --message|-m)
            if [[ $# -lt 2 ]]; then
                error "Missing value for $1"
                usage
                exit 1
            fi
            MESSAGE="$2"
            shift 2
            ;;
        --body|-b)
            if [[ $# -lt 2 ]]; then
                error "Missing value for $1"
                usage
                exit 1
            fi
            BODY="$2"
            shift 2
            ;;
        *)
            error "Unknown argument: $1"
            usage
            exit 1
            ;;
    esac
done

# Require at least some staged changes
if git diff --cached --quiet 2>/dev/null; then
    error "No staged changes to commit"
    error "Run 'git add <files>' first (this script does NOT auto-stage)"
    exit 1
fi

if [[ -z "$MESSAGE" ]]; then
    error "Commit subject is required"
    usage
    exit 1
fi

if [[ -z "${BODY//[[:space:]]/}" ]]; then
    error "Commit body is required"
    error "Use --body to explain WHY this change is needed, not just WHAT changed."
    usage
    exit 1
fi

# Validate conventional commit format (uses shared regex from commit-types.sh)
if ! echo "$MESSAGE" | grep -qE "$CONVENTIONAL_REGEX"; then
    error "Invalid commit message format"
    error "Expected: type(scope): description"
    error "Types: ${COMMIT_TYPES[*]}"
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
if ! git commit -m "$MESSAGE" -m "$BODY"; then
    error "Commit failed"
    exit 1
fi

COMMIT_SHA=$(git rev-parse HEAD)
success "Created commit: ${COMMIT_SHA:0:8}"
success "Message: $MESSAGE"

exit 0
