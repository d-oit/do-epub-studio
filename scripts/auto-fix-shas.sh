#!/usr/bin/env bash
# Auto-fix SHA allowlist when workflow validation finds disallowed SHAs.
# Usage: bash scripts/auto-fix-shas.sh [--dry-run]
# Designed to run after a failed workflow validation to self-heal.
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
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
