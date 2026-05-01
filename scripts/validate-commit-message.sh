#!/bin/bash
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

# Configuration
readonly MAX_COMMIT_SUBJECT_LENGTH=72
readonly MAX_PR_TITLE_LENGTH=72

# Valid commit types
readonly VALID_TYPES=(
    "feat"
    "fix"
    "docs"
    "style"
    "refactor"
    "test"
    "chore"
    "ci"
    "build"
    "perf"
    "revert"
    "feat!"
    "fix!"
)

# Colors (if terminal supports it)
if [[ -t 1 ]]; then
    readonly RED='\033[0;31m'
    readonly GREEN='\033[0;32m'
    readonly YELLOW='\033[1;33m'
    readonly NC='\033[0m' # No Color
else
    readonly RED=''
    readonly GREEN=''
    readonly YELLOW=''
    readonly NC=''
fi

# Usage function
usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] <commit-message-file>

Validate commit messages follow conventional commits format.

Options:
    -h, --help     Show this help message
    -v, --verbose  Show detailed validation output

Format: type(scope): description

Examples:
    feat(auth): add OAuth2 login
    fix(api): resolve timeout issue
    docs(readme): update installation instructions

Types: ${VALID_TYPES[*]}

Exit codes:
    0 - Valid commit message
    1 - Invalid commit message
EOF
    exit 0
}

# Error function
error() {
    echo -e "${RED}ERROR:${NC} $1" >&2
}

# Warning function
warn() {
    echo -e "${YELLOW}WARNING:${NC} $1" >&2
}

# Success function
success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Verbose output
verbose() {
    if [[ "${VERBOSE:-false}" == "true" ]]; then
        echo -e "${YELLOW}→${NC} $1"
    fi
}

# Parse arguments
VERBOSE=false
COMMIT_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -*)
            error "Unknown option: $1"
            exit 1
            ;;
        *)
            COMMIT_FILE="$1"
            shift
            ;;
    esac
done

# Check if commit file provided
if [[ -z "$COMMIT_FILE" ]]; then
    error "Commit message file required"
    echo "Usage: $(basename "$0") <commit-message-file>"
    exit 1
fi

# Check if file exists
if [[ ! -f "$COMMIT_FILE" ]]; then
    error "File not found: $COMMIT_FILE"
    exit 1
fi

# Read commit message
COMMIT_MSG=$(cat "$COMMIT_FILE")

# Skip merge commits and amend commits
if [[ "$COMMIT_MSG" =~ ^Merge ]]; then
    verbose "Merge commit detected, skipping validation"
    exit 0
fi

if [[ "$COMMIT_MSG" =~ ^Revert ]]; then
    verbose "Revert commit detected, allowing"
fi

if [[ "$COMMIT_MSG" =~ ^#\ No\s+commit\s+message ]]; then
    error "No commit message provided"
    exit 1
fi

# Get the first line (subject)
COMMIT_SUBJECT=$(echo "$COMMIT_MSG" | head -n1)

verbose "Validating: $COMMIT_SUBJECT"

# Check 1: Empty message
if [[ -z "${COMMIT_SUBJECT// }" ]]; then
    error "Commit message is empty"
    exit 1
fi

# Check 2: Too long
if [[ ${#COMMIT_SUBJECT} -gt $MAX_COMMIT_SUBJECT_LENGTH ]]; then
    error "Commit subject too long: ${#COMMIT_SUBJECT} chars (max: $MAX_COMMIT_SUBJECT_LENGTH)"
    error "Subject: $COMMIT_SUBJECT"
    exit 1
fi

# Check 3: Format - must match type(scope): description
if [[ ! "$COMMIT_SUBJECT" =~ ^([a-z]+)(\(.+\))?:[[:space:]].+ ]]; then
    error "Invalid commit format"
    error "Expected: type(scope): description"
    error "Got: $COMMIT_SUBJECT"
    error ""
    error "Valid types: ${VALID_TYPES[*]}"
    exit 1
fi

# Extract type
COMMIT_TYPE="${BASH_REMATCH[1]}"

# Check 4: Valid type
VALID=false
for type in "${VALID_TYPES[@]}"; do
    if [[ "$COMMIT_TYPE" == "$type" ]]; then
        VALID=true
        break
    fi
done

if [[ "$VALID" == "false" ]]; then
    error "Invalid commit type: $COMMIT_TYPE"
    error "Valid types: ${VALID_TYPES[*]}"
    exit 1
fi

# Check 5: Description not just type repetition
SCOPE="${BASH_REMATCH[2]:-}"
DESCRIPTION="${BASH_REMATCH[3]:-}"

if [[ -n "$SCOPE" ]]; then
    # Remove parentheses from scope for check
    SCOPE_NAME="${SCOPE//[()]/}"

    # Check if description repeats the scope or type
    if [[ "${DESCRIPTION,,}" == *"${SCOPE_NAME,,}"* ]] || \
       [[ "${DESCRIPTION,,}" == *"${COMMIT_TYPE}"* ]]; then
        warn "Description seems to repeat scope or type"
    fi
fi

# Check 6: Lowercase start
if [[ "$COMMIT_SUBJECT" =~ ^[A-Z] ]]; then
    error "Commit subject must start with lowercase"
    exit 1
fi

# Check 7: No trailing period
if [[ "$COMMIT_SUBJECT" =~ \.$ ]]; then
    warn "Commit subject should not end with a period"
fi

# Check 8: Body lines (if any) not too long
BODY_LINES=$(echo "$COMMIT_MSG" | tail -n +3)
while IFS= read -r line; do
    if [[ ${#line} -gt 72 ]]; then
        warn "Body line too long (${#line} chars): ${line:0:50}..."
    fi
done <<< "$BODY_LINES"

# All checks passed
success "Commit message is valid"
verbose "Type: $COMMIT_TYPE"
verbose "Length: ${#COMMIT_SUBJECT}/$MAX_COMMIT_SUBJECT_LENGTH"

exit 0
