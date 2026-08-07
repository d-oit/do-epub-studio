#!/usr/bin/env bash
# scripts/generate-bundle-baseline.sh
#
# Build the web app and generate bundle-baseline.json for the current commit.
# This script is intended to be run before committing a baseline update.
#
# Usage:
#   ./scripts/generate-bundle-baseline.sh [--output <path>]
#
# Exit codes:
#   0  Baseline generated successfully
#   1  Build or baseline generation failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Building web app ==="
cd "$ROOT_DIR"
pnpm --filter web build

echo ""
echo "=== Generating bundle baseline ==="
node "$SCRIPT_DIR/bundle-baseline.mjs" "$@"

echo ""
echo "Done. Review bundle-baseline.json and commit it."
