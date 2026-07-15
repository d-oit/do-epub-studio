#!/usr/bin/env bash
# Shared commit type and scope definitions.
# Single source of truth for all commit validators.
# Source this file; do not execute directly.
#
# Used by:
#   - scripts/atomic-commit/commit.sh
#   - scripts/hooks/commit-msg
#   - scripts/validate-commit-message.sh

# Valid conventional commit types
# Must match across all validators — parity tests enforce this.
COMMIT_TYPES=(
    "feat"
    "fix"
    "docs"
    "style"
    "refactor"
    "perf"
    "test"
    "ci"
    "chore"
    "build"
    "revert"
)

# Valid scopes (optional, lowercase alphanumeric + hyphens/underscores)
COMMIT_SCOPES=(
    "web"
    "worker"
    "reader-core"
    "shared"
    "schema"
    "testkit"
    "ui"
    "infra"
    "ci"
    "security"
    "ux"
    "a11y"
    "deps"
    "plans"
    "reader"
    "api"
    "auth"
    "offline"
    "sync"
    "admin"
    "catalog"
    "epub"
    "hooks"
    "scripts"
    "release"
    "quality"
)

# Build regex pattern from types array
_join_types() {
    local IFS='|'
    echo "${COMMIT_TYPES[*]}"
}

# Conventional commit regex: type(scope): description
# Scope is optional. Breaking change indicator (!) allowed before colon.
# shellcheck disable=SC2034  # Used by sourcing scripts (commit.sh, hooks/commit-msg, etc.)
COMMIT_TYPE_REGEX="$(_join_types)"
# shellcheck disable=SC2034  # Used by sourcing scripts for grep -qE validation
CONVENTIONAL_REGEX="^(${COMMIT_TYPE_REGEX})(\([a-z0-9_-]+\))?!?: .+"

# Check if a type is valid
is_valid_commit_type() {
    local type="$1"
    for t in "${COMMIT_TYPES[@]}"; do
        [[ "$t" == "$type" ]] && return 0
    done
    return 1
}

# Check if a scope is valid (empty scope is valid — it's optional)
is_valid_commit_scope() {
    local scope="$1"
    [[ -z "$scope" ]] && return 0
    # Strip parentheses
    scope="${scope//[()]/}"
    for s in "${COMMIT_SCOPES[@]}"; do
        [[ "$s" == "$scope" ]] && return 0
    done
    # Allow unknown scopes — warn but don't fail
    # This is intentional: new scopes can be added without updating all validators
    return 0
}
