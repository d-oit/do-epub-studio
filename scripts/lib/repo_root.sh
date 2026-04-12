#!/usr/bin/env bash
# Shared REPO_ROOT detection.
# Usage: source "$REPO_ROOT/scripts/lib/repo_root.sh"
# Sets REPO_ROOT to the repository root directory.

if [[ -z "${REPO_ROOT:-}" ]]; then
    REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi

# Ensure we're actually in the repo root
if [[ ! -f "$REPO_ROOT/package.json" ]]; then
    echo "Warning: REPO_ROOT=$REPO_ROOT does not contain package.json" >&2
fi
