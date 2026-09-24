#!/usr/bin/env bash
# Shared commit type and scope definitions.
# Single source of truth for all commit validators.
# Source this file; do not execute directly.
#
# Used by:
#   - scripts/atomic-commit/commit.sh
#   - scripts/hooks/commit-msg
#   - scripts/validate-commit-message.sh
#
# ADR-279: this file is the ONLY canonical type list. commitlint.config.cjs is
# a mirror kept in parity by scripts/__tests__/commit-validator-parity.test.mjs
# (which runs in CI), and .github/workflows/validate-commit-title.yml enforces
# commits and PR titles with scripts/hooks/commit-msg itself — CI can never be
# stricter than the local hook.

# Valid conventional commit types
# Must match across all validators — parity tests enforce this.
# security/a11y/plans were added by ADR-279: real history uses them
# (5x `security(...)` and 1x `plans:` commits exist on main) and the old
# commitlint type-enum already listed them — the union lives HERE, not in
# commitlint.
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
    "security"
    "a11y"
    "plans"
)

# Advisory scope vocabulary (optional, lowercase alphanumeric + hyphens/underscores).
# ADR-279: NOT enforced anywhere — validators accept any [a-z0-9_-]+ scope because
# scopes are genuinely dynamic (plan IDs like `goap-277`, `plan-121`, PR numbers,
# wave/batch labels). 74 distinct scopes appear in the last 500 commits vs. the 26
# listed here, and `is_valid_commit_scope` exists only to WARN. Never wire an enum
# of this list into CI: it would be stricter than scripts/hooks/commit-msg and red
# on live main history.
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

# Check if a scope is known (empty scope is valid — it's optional).
# Returns 0 for known scopes, 1 for unknown.
# Validators may use this to warn about unrecognized scopes without failing.
is_valid_commit_scope() {
    local scope="$1"
    [[ -z "$scope" ]] && return 0
    # Strip parentheses
    scope="${scope//[()]/}"
    for s in "${COMMIT_SCOPES[@]}"; do
        [[ "$s" == "$scope" ]] && return 0
    done
    return 1
}
