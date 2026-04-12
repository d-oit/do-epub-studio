#!/usr/bin/env bash
# Validate git hooks configuration to prevent global hooks from overriding local hooks.
# Exit 0 = no global hooks detected, Exit 1 = global hooks detected (warning issued).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

# Check for global hooks path configuration
GLOBAL_HOOKS_PATH=$(git config --global core.hooksPath 2>/dev/null || true)
LOCAL_HOOKS_PATH=$(git config --local core.hooksPath 2>/dev/null || true)

if [ -n "$GLOBAL_HOOKS_PATH" ]; then
    printf '%s✗ ERROR: Global git hooks path is set!%s\n' "${RED}" "${NC}" >&2
    printf '   Global hooks path: %s%s%s\n' "${YELLOW}" "$GLOBAL_HOOKS_PATH" "${NC}" >&2
    echo "" >&2
    echo "This can prevent local pre-commit hooks from running." >&2
    echo "" >&2
    echo "To fix this, choose one option:" >&2
    echo "" >&2
    echo "  Option 1 - Remove global hooks (recommended for this repo):" >&2
    echo "    git config --global --unset core.hooksPath" >&2
    echo "" >&2
    echo "  Option 2 - Disable global hooks for this repo only:" >&2
    echo "    git config --local core.hooksPath .git/hooks" >&2
    echo "" >&2
    echo "  Option 3 - Skip this check (not recommended):" >&2
    echo "    SKIP_GLOBAL_HOOKS_CHECK=true git commit ..." >&2
    echo "" >&2
    exit 1
fi

# Check if local hooks path is correctly set
if [ -n "$LOCAL_HOOKS_PATH" ] && [ "$LOCAL_HOOKS_PATH" != ".git/hooks" ]; then
    printf '%s✗ ERROR: Local hooks path is non-standard!%s\n' "${RED}" "${NC}" >&2
    printf '   Local hooks path: %s%s%s\n' "${YELLOW}" "$LOCAL_HOOKS_PATH" "${NC}" >&2
    echo "" >&2
    echo "To reset to standard path:" >&2
    echo "    git config --local core.hooksPath .git/hooks" >&2
    echo "" >&2
    exit 1
fi

printf '%s✓ Git hooks configuration validated%s\n' "${GREEN}" "${NC}"
exit 0
