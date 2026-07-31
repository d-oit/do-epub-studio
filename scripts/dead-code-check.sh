#!/usr/bin/env bash
# Checks for dead code (knip) and circular dependencies (madge).
# Exit 0 = clean. Exit 1 = violations found.
#
# Knip exit codes: 0 = no error-severity violations (warnings are allowed).
# Madge: any circular dependency is flagged; pre-existing ones are baselined.
#
# The madge circular-dep baseline is read dynamically from
# `knip-baseline.json` (`madgeCircularDeps` array length) so it stays in
# sync when circulars are resolved. Fail only if the count *exceeds* the
# baseline.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

FAILED=0

# Read the baseline count from knip-baseline.json (falls back to 0 if missing)
BASELINE_FILE="$REPO_ROOT/knip-baseline.json"
if [ -f "$BASELINE_FILE" ]; then
  MADGE_BASELINE=$(node -e "const b=require('./knip-baseline.json'); console.log((b.madgeCircularDeps||[]).length)" 2>/dev/null || echo 0)
else
  MADGE_BASELINE=0
fi

echo "=== knip: unused exports/deps/files ==="
if ! pnpm knip --no-progress; then
    echo "knip found violations." >&2
    FAILED=1
fi
echo ""

echo "=== madge: circular dependencies ==="
MADGE_OUT="$(pnpm madge --circular --extensions ts,tsx \
  apps/web/src apps/worker/src \
  packages/shared/src packages/schema/src \
  packages/reader-core/src packages/ui/src \
  packages/testkit/src 2>&1)" || true

echo "$MADGE_OUT"

MADGE_FOUND=$(echo "$MADGE_OUT" | grep -c "^[0-9]\+)" || true)

if [ "$MADGE_FOUND" -gt "$MADGE_BASELINE" ]; then
    echo "" >&2
    echo "madge: found $MADGE_FOUND circular deps — $MADGE_BASELINE are baselined, $((MADGE_FOUND - MADGE_BASELINE)) are new." >&2
    echo "Fix the new circular dependencies above." >&2
    FAILED=1
elif [ "$MADGE_FOUND" -gt 0 ]; then
    echo ""
    echo "madge: $MADGE_FOUND circular dep(s) found (all $MADGE_FOUND are pre-existing baseline — not blocking)."
fi

echo ""
if [ "$FAILED" -ne 0 ]; then
    echo "Dead code check FAILED." >&2
    exit 1
fi

echo "Dead code check passed."
