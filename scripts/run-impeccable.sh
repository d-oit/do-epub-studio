#!/usr/bin/env bash
# run-impeccable.sh — wrapper for impeccable detect with CI-friendly output
# Usage: ./scripts/run-impeccable.sh [--required]
#   --required: exit non-zero on findings (default: warn only)

set -euo pipefail

REQUIRED="${IMPECCABLE_REQUIRED:-0}"
if [[ "${1:-}" == "--required" ]]; then
  REQUIRED=1
fi

OUTPUT_FILE=".impeccable/last-run.json"
mkdir -p .impeccable

echo "::group::Impeccable design detector"

if npx impeccable detect --json . > "$OUTPUT_FILE" 2>/dev/null; then
  FINDINGS=$(jq '.findings | length' "$OUTPUT_FILE" 2>/dev/null || echo "0")
  echo "Impeccable: $FINDINGS finding(s) in $OUTPUT_FILE"
else
  FINDINGS=-1
  echo "Impeccable detect failed (non-zero exit or parse error)"
fi

echo "::endgroup::"

if [[ "$REQUIRED" == "1" && "$FINDINGS" -gt 0 ]]; then
  echo "::error::Impeccable found $FINDINGS design issue(s). See $OUTPUT_FILE"
  echo "To suppress for this run: SKIP_DESIGN=1 ./scripts/quality_gate.sh"
  exit 1
elif [[ "$FINDINGS" -gt 0 ]]; then
  echo "::warning::Impeccable found $FINDINGS design issue(s). See $OUTPUT_FILE"
  echo "Promote to required: IMPECCABLE_REQUIRED=1 ./scripts/quality_gate.sh"
elif [[ "$FINDINGS" == "0" ]]; then
  echo "Impeccable: no findings."
fi
