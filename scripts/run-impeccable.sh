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

# Ensure storybook-static and other generated output is excluded from scanning.
# The submodule's config.json is local and not tracked; create one if missing.
CONFIG_FILE=".impeccable/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
  cat > "$CONFIG_FILE" <<'CONF'
{
  "$schema": "https://impeccable.style/config.json",
  "detector": {
    "designSystem": { "enabled": true },
    "ignoreFiles": [
      ".impeccable/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/storybook-static/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "apps/worker/src/worker-configuration.d.ts"
    ],
    "ignoreValues": [
      { "rule": "overused-font", "value": "Geist", "reason": "Intentional brand font choice" },
      { "rule": "bounce-easing", "value": "cubic-bezier(0.34, 1.56, 0.64, 1)", "reason": "Intentional bounce animation for playful interactions" }
    ]
  }
}
CONF
fi

echo "::group::Impeccable design detector"

npx impeccable detect --json . > "$OUTPUT_FILE" 2>/dev/null || true
if [ -f "$OUTPUT_FILE" ] && jq empty "$OUTPUT_FILE" 2>/dev/null; then
  FINDINGS=$(jq 'length' "$OUTPUT_FILE" 2>/dev/null || echo "0")
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
