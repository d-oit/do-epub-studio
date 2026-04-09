#!/usr/bin/env bash
# Health check for csm (Chaotic Semantic Memory) CLI.
# Exit 0 = healthy, Exit 1 = degraded (fallback to grep), Exit 2 = missing.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/..")"

if ! command -v csm &>/dev/null; then
    echo "WARN: csm CLI not installed. Falling back to grep for memory queries."
    echo "Install: cargo install chaotic_semantic_memory --features cli"
    exit 1
fi

# Verify csm can run a basic query
if ! csm query "test" --top-k 1 --base-dir "$REPO_ROOT/plans" &>/dev/null; then
    echo "WARN: csm index may be missing. Run: csm index-dir --glob 'plans/**/*.md' --heading-level 2"
    exit 1
fi

echo "csm CLI healthy"
exit 0
