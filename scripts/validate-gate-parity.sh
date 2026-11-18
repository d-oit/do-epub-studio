#!/usr/bin/env bash
# Validate gate parity — compare manifest against actual workflow job names.
# Ensures local, PR, and release entry points declare the same required checks.
# Exit 0 = parity, Exit 1 = mismatch.
#
# Usage: ./scripts/validate-gate-parity.sh
#
# PR and release checks are validated by scripts/validate-gate-parity.mjs,
# which parses every workflow with js-yaml and matches claims ONLY against
# real job-level check contexts (matrix-expanded `name:` values or job ids),
# plus the explicitly declared external Codacy check. Step names, comments,
# and other workflow text can never satisfy a job claim. The three release
# readiness obligations implemented as steps of the `release-readiness` job
# are validated against that job's step list, so removing a required step or
# the job itself fails the validator. The local gate phases are checked below
# by grepping the gate and its sourced phase libs (ADR-278 pattern).
#
# Tests may point the script at a fixture tree with GATE_PARITY_REPO_ROOT.

set -euo pipefail

REPO_ROOT="${GATE_PARITY_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$REPO_ROOT" || exit 1

# shellcheck source=scripts/lib/colors.sh
if [[ -f "$REPO_ROOT/scripts/lib/colors.sh" ]]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/scripts/lib/colors.sh"
fi
: "${BLUE:=}" "${NC:=}" "${RED:=}" "${GREEN:=}" "${YELLOW:=}" "${BOLD:=}"

FAILED=0
MANIFEST="$REPO_ROOT/scripts/gate-manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  printf '%s✗ Gate manifest not found: %s%s\n' "$RED" "$MANIFEST" "$NC"
  exit 1
fi

# Verify jq is available
if ! command -v jq &> /dev/null; then
  printf '%s✗ jq is required but not available%s\n' "$RED" "$NC"
  exit 1
fi

printf '%s═════════════════════════════════════════════════════════════════%s\n' "$BLUE" "$NC"
printf '%s  Gate Parity Validation%s\n' "$BOLD" "$NC"
printf '%s═════════════════════════════════════════════════════════════════%s\n' "$BLUE" "$NC"

# Check local gate has all required phases
LOCAL_CHECKS=$(jq -r '.local.checks[]' "$MANIFEST" 2>/dev/null)
printf '\n%s▸ Local gate checks:%s\n' "$BLUE" "$NC"
# A phase may be invoked directly by the gate or by a phase lib the gate
# actually `source`s (scripts/lib/quality_gate_*.sh — the ADR-278 extraction
# pattern). Only sourced files count: an unsourced lib must not satisfy this.
GATE_FILE="$REPO_ROOT/scripts/quality_gate.sh"
PHASE_FILES=("$GATE_FILE")
while IFS= read -r sourced; do
  [[ -n "$sourced" ]] && PHASE_FILES+=("$REPO_ROOT/$sourced")
done < <(grep -oE 'source "\$REPO_ROOT/[^"]+"' "$GATE_FILE" 2>/dev/null \
  | sed -E 's/.*\$REPO_ROOT\/([^"]+)"/\1/')

phase_is_invoked() {
  local check="$1" file
  for file in "${PHASE_FILES[@]}"; do
    if [[ -f "$file" ]] && grep -qF -- "$check" "$file" 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

while IFS= read -r check; do
  [[ -z "$check" ]] && continue
  if phase_is_invoked "$check"; then
    printf '  %s✓%s %s\n' "$GREEN" "$NC" "$check"
  else
    printf '  %s✗%s %s (not found in quality_gate.sh or its sourced phase libs)\n' "$RED" "$NC" "$check"
    FAILED=1
  fi
done <<< "$LOCAL_CHECKS"

# PR and release checks are parser-backed: exact job-level contexts from the
# workflows (matrix-expanded), the declared external app checks, and the
# required steps of the release-readiness job. The node helper prints its own
# section output and exits nonzero on any malformed/missing input or unmet
# obligation.
if ! node scripts/validate-gate-parity.mjs --root "$REPO_ROOT"; then
  FAILED=1
fi

echo ""
if [[ $FAILED -ne 0 ]]; then
  printf '%s✗ Gate parity check failed — see above for mismatches%s\n' "$RED" "$NC"
  exit 1
fi

exit 0
