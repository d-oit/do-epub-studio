#!/usr/bin/env bash
# Auto-fix SHA allowlist when workflow validation finds disallowed SHAs.
# Usage: bash scripts/auto-fix-shas.sh [--dry-run] [--check-only]
#
# WARNING: This is a DEVELOPER UTILITY only. It must NOT run in CI.
# CI validation is handled by scripts/validate-workflows.sh which treats
# unknown SHAs as failures (fail-closed per ADR-187).
#
# The --check-only mode reports unlisted SHAs without modifying the allowlist,
# useful for pre-commit hooks and local validation.

set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DRY_RUN=false
CHECK_ONLY=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --check-only) CHECK_ONLY=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Fail-closed: refuse to run in CI environments
if [[ "${CI:-}" == "true" ]] || [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    echo "ERROR: auto-fix-shas.sh must not run in CI."
    echo "  Unknown SHAs must fail validation and be added through a reviewed change."
    echo "  Use scripts/validate-workflows.sh for CI validation."
    exit 1
fi

ALLOWLIST_FILE="scripts/validate-shas.sh"
WORKFLOW_DIR=".github/workflows"

# Find all uses: lines in workflow files
disallowed=()
while IFS= read -r line; do
    uses_val=$(echo "$line" | sed -n 's/.*uses:\s*\(.*\)/\1/p' | sed 's/\s*#.*//' | xargs)
    [[ -z "$uses_val" ]] && continue
    [[ "$uses_val" == ./* ]] || [[ "$uses_val" == "./"* ]] && continue
    # Extract action@sha
    action_with_sha=$(echo "$uses_val" | cut -d' ' -f1)
    [[ "$action_with_sha" =~ @[a-f0-9]{40}$ ]] || continue
    # Check if already in allowlist
    if ! grep -qF "$action_with_sha" "$ALLOWLIST_FILE" 2>/dev/null; then
        disallowed+=("$action_with_sha")
    fi
done < <(grep -rnE "^[[:space:]]*-?[[:space:]]*uses:" "$WORKFLOW_DIR" 2>/dev/null || true)

if [[ ${#disallowed[@]} -eq 0 ]]; then
    echo "✓ All action SHAs are in allowlist"
    exit 0
fi

echo "Found ${#disallowed[@]} disallowed SHA(s):"
printf '  %s\n' "${disallowed[@]}"

if $CHECK_ONLY; then
    echo ""
    echo "CHECK-ONLY: These SHAs must be added through a reviewed allowlist change."
    echo "  1. Verify the action repository, tag, and commit provenance"
    echo "  2. Add to $ALLOWLIST_FILE with a comment linking the review"
    echo "  3. Commit via: ./scripts/atomic-commit/run.sh --message \"ci(shas): ...\" --body \"...\""
    exit 1
fi

if $DRY_RUN; then
    echo "DRY-RUN: would add to $ALLOWLIST_FILE"
    exit 0
fi

# Add new SHAs to allowlist (before the closing parenthesis)
for entry in "${disallowed[@]}"; do
    if grep -qF "$entry" "$ALLOWLIST_FILE" 2>/dev/null; then
        continue
    fi
    echo "Adding: $entry"
    sed -i "/^)/i\\    \"$entry\"" "$ALLOWLIST_FILE"
done

echo "✓ Updated $ALLOWLIST_FILE with ${#disallowed[@]} new SHA(s)"
