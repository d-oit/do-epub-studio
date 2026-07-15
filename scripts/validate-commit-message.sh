#!/usr/bin/env bash
#
# validate-commit-message.sh
# Validates commit messages follow the conventional commits format.
#
# Usage:
#   ./validate-commit-message.sh <commit-message-file>
#   ./validate-commit-message.sh --help
#
# Exit codes:
#   0 - Valid commit message
#   1 - Invalid commit message

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source shared commit types (single source of truth)
# shellcheck source=scripts/lib/commit-types.sh
source "$SCRIPT_DIR/lib/commit-types.sh"

# Configuration
readonly MAX_COMMIT_SUBJECT_LENGTH=72
# shellcheck disable=SC2034
readonly MAX_PR_TITLE_LENGTH=72

# Colors (if terminal supports it)
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
fi

usage() {
    echo "Usage: validate-commit-message.sh [OPTIONS] <commit-message-file>"
    echo ""
    echo "Validate commit messages follow conventional commits format."
    echo ""
    echo "Options:"
    echo "    -h, --help     Show this help message"
    echo "    -v, --verbose  Show detailed validation output"
    echo ""
    echo "Format: type(scope): description"
    echo ""
    echo "Types: ${COMMIT_TYPES[*]}"
    exit 0
}

error() { echo -e "${RED}ERROR:${NC} $1" >&2; }
warn()  { echo -e "${YELLOW}WARNING:${NC} $1" >&2; }
success() { echo -e "${GREEN}✓${NC} $1"; }

VERBOSE=false
COMMIT_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help) usage ;;
        -v|--verbose) VERBOSE=true; shift ;;
        -*) error "Unknown option: $1"; exit 1 ;;
        *) COMMIT_FILE="$1"; shift ;;
    esac
done

if [[ -z "$COMMIT_FILE" ]]; then
    error "Commit message file required"
    exit 1
fi

if [[ ! -f "$COMMIT_FILE" ]]; then
    error "File not found: $COMMIT_FILE"
    exit 1
fi

COMMIT_MSG=$(cat "$COMMIT_FILE")

# Skip merge, revert, and auto-generated commits (same as hooks/commit-msg)
if [[ "$COMMIT_MSG" =~ ^Merge ]] || [[ "$COMMIT_MSG" =~ ^Revert ]] || \
   [[ "$COMMIT_MSG" =~ ^WIP ]] || [[ "$COMMIT_MSG" =~ ^fixup! ]] || \
   [[ "$COMMIT_MSG" =~ ^squash! ]]; then
    [[ "$VERBOSE" == "true" ]] && echo "Merge/Revert/auto-generated commit detected, skipping"
    exit 0
fi

COMMIT_SUBJECT=$(echo "$COMMIT_MSG" | head -n1)

# Check: Empty
if [[ -z "${COMMIT_SUBJECT// }" ]]; then
    error "Commit message is empty"
    exit 1
fi

# Check: Too long
if [[ ${#COMMIT_SUBJECT} -gt $MAX_COMMIT_SUBJECT_LENGTH ]]; then
    error "Commit subject too long: ${#COMMIT_SUBJECT} chars (max: $MAX_COMMIT_SUBJECT_LENGTH)"
    exit 1
fi

# Check: Format — type(scope): description
# Must match the shared CONVENTIONAL_REGEX which handles breaking change indicator (!)
if [[ ! "$COMMIT_SUBJECT" =~ ^([a-z]+)(\([a-z0-9_-]+\))?!?:[[:space:]].+ ]]; then
    error "Invalid commit format"
    error "Expected: type(scope): description"
    error "Got: $COMMIT_SUBJECT"
    error "Valid types: ${COMMIT_TYPES[*]}"
    exit 1
fi

COMMIT_TYPE="${BASH_REMATCH[1]}"

# Check: Valid type (uses shared types from commit-types.sh)
if ! is_valid_commit_type "$COMMIT_TYPE"; then
    error "Invalid commit type: $COMMIT_TYPE"
    error "Valid types: ${COMMIT_TYPES[*]}"
    exit 1
fi

# Check: Lowercase start
if [[ "$COMMIT_SUBJECT" =~ ^[A-Z] ]]; then
    error "Commit subject must start with lowercase"
    exit 1
fi

# Check: No trailing period
if [[ "$COMMIT_SUBJECT" =~ \.$ ]]; then
    warn "Commit subject should not end with a period"
fi

success "Commit message is valid"
[[ "$VERBOSE" == "true" ]] && echo "  Type: $COMMIT_TYPE, Length: ${#COMMIT_SUBJECT}/$MAX_COMMIT_SUBJECT_LENGTH"
exit 0
