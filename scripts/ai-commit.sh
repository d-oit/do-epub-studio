#!/usr/bin/env bash
# AI-assisted conventional commit message generator
# Analyzes staged changes and guides the user through composing a valid commit message.
# Usage: ./scripts/ai-commit.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

readonly E_SUCCESS=0
readonly E_NO_STAGED=1
readonly E_VALIDATION=2

readonly VALID_TYPES=("feat" "fix" "docs" "style" "refactor" "test" "chore" "ci" "build" "perf" "revert")

show_help() {
    cat << 'EOF'
Usage: ai-commit.sh [OPTIONS]

Analyzes staged changes and interactively builds a conventional commit message.

Options:
    -h, --help    Show this help message

The script will:
  1. Show staged files and line stats
  2. Prompt for commit type, scope, and description
  3. Validate the final message (max 72 chars)
  4. Output the final git commit command

Exit codes:
    0   Success
    1   No staged changes found
    2   Validation failed
EOF
    exit 0
}

main() {
    for arg in "$@"; do
        case "$arg" in
            -h|--help)
                show_help
                ;;
        esac
    done

    cd "$REPO_ROOT"

    # Check for staged changes
    if git diff --cached --quiet 2>/dev/null; then
        printf '%sNo staged changes found.%s\n' "${YELLOW}" "${NC}"
        printf 'Stage your changes with git add first.\n'
        exit $E_NO_STAGED
    fi

    echo ""
    printf '%s=== Staged Changes ===%s\n' "${BOLD}${BLUE}" "${NC}"
    echo ""

    # Show staged file list with stats
    git diff --cached --stat --diff-algorithm=default
    echo ""

    # Count lines added/deleted
    local add_count del_count
    add_count=$(git diff --cached --numstat | awk '{s+=$1} END {print s+0}')
    del_count=$(git diff --cached --numstat | awk '{s+=$2} END {print s+0}')

    printf '  Lines added:    %s%d%s\n' "${GREEN}" "$add_count" "${NC}"
    printf '  Lines deleted:  %s%d%s\n' "${RED}" "$del_count" "${NC}"

    # Count changed files
    local file_count
    file_count=$(git diff --cached --name-only | wc -l)
    printf '  Files changed:  %d\n' "$file_count"
    echo ""

    # --- Prompt for commit components ---
    printf '%s=== Commit Message Composition ===%s\n' "${BOLD}${BLUE}" "${NC}"
    echo ""

    # Type selection
    echo "Valid types: ${VALID_TYPES[*]}"
    printf 'Enter commit type (%sfix%s): ' "${GREEN}" "${NC}"
    read -r COMMIT_TYPE
    COMMIT_TYPE="${COMMIT_TYPE:-fix}"

    # Validate type
    local type_valid=false
    for t in "${VALID_TYPES[@]}"; do
        if [[ "$COMMIT_TYPE" == "$t" ]]; then
            type_valid=true
            break
        fi
    done
    if [[ "$type_valid" == "false" ]]; then
        printf '%sInvalid type: %s. Valid types: %s%s\n' "${RED}" "$COMMIT_TYPE" "${VALID_TYPES[*]}" "${NC}"
        exit $E_VALIDATION
    fi

    # Scope (optional)
    printf 'Enter scope (optional, press Enter to skip): '
    read -r COMMIT_SCOPE
    COMMIT_SCOPE="${COMMIT_SCOPE:-}"

    # Description
    printf 'Enter short description: '
    read -r COMMIT_DESC
    if [[ -z "${COMMIT_DESC:-}" ]]; then
        printf '%sDescription cannot be empty%s\n' "${RED}" "${NC}"
        exit $E_VALIDATION
    fi

    # Build commit message
    local COMMIT_MSG
    if [[ -n "$COMMIT_SCOPE" ]]; then
        COMMIT_MSG="${COMMIT_TYPE}(${COMMIT_SCOPE}): ${COMMIT_DESC}"
    else
        COMMIT_MSG="${COMMIT_TYPE}: ${COMMIT_DESC}"
    fi

    echo ""

    # Validate length
    local msg_len=${#COMMIT_MSG}
    if [[ $msg_len -gt 72 ]]; then
        printf '%sCommit message is too long: %d chars (max 72)%s\n' "${RED}" "$msg_len" "${NC}"
        printf 'Message: %s\n' "$COMMIT_MSG"
        exit $E_VALIDATION
    fi

    # Show result
    printf '%s=== Final Commit Message ===%s\n' "${BOLD}${GREEN}" "${NC}"
    echo ""
    printf '  %s%s%s\n' "${BOLD}" "$COMMIT_MSG" "${NC}"
    printf '  (%d characters)\n' "$msg_len"
    echo ""

    # Output command
    printf '%sRun this command to commit:%s\n' "${BOLD}${BLUE}" "${NC}"
    echo ""
    printf '  git commit -m "%s"\n' "$COMMIT_MSG"
    echo ""
    printf '%sOr use the atomic commit workflow:%s\n' "${YELLOW}" "${NC}"
    printf '  ./scripts/atomic-commit/run.sh --message "%s"\n' "$COMMIT_MSG"
    echo ""

    exit $E_SUCCESS
}

main "$@"
