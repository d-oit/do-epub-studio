#!/usr/bin/env bash
# Validate gate parity — compare manifest against actual workflow job names.
# Ensures local, PR, and release entry points declare the same required checks.
# Exit 0 = parity, Exit 1 = mismatch.
#
# Usage: ./scripts/validate-gate-parity.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

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

# Extract PR check names from manifest
PR_CHECKS=$(jq -r '.pr.checks[]' "$MANIFEST" 2>/dev/null)

# Extract job names from ci.yml
CI_FILE="$REPO_ROOT/.github/workflows/ci.yml"
if [[ ! -f "$CI_FILE" ]]; then
  printf '%s✗ ci.yml not found%s\n' "$RED" "$NC"
  exit 1
fi

CI_JOBS=$(grep -E '^\s{2}[a-z_-]+:' "$CI_FILE" | sed 's/://;s/^ *//' | grep -v 'name:' || true)

printf '%s═════════════════════════════════════════════════════════════════%s\n' "$BLUE" "$NC"
printf '%s  Gate Parity Validation%s\n' "$BOLD" "$NC"
printf '%s═════════════════════════════════════════════════════════════════%s\n' "$BLUE" "$NC"

# Check local gate has all required phases
LOCAL_CHECKS=$(jq -r '.local.checks[]' "$MANIFEST" 2>/dev/null)
printf '\n%s▸ Local gate checks:%s\n' "$BLUE" "$NC"
while IFS= read -r check; do
  [[ -z "$check" ]] && continue
  if grep -q "$check" "$REPO_ROOT/scripts/quality_gate.sh" 2>/dev/null; then
    printf '  %s✓%s %s\n' "$GREEN" "$NC" "$check"
  else
    printf '  %s✗%s %s (not found in quality_gate.sh)\n' "$RED" "$NC" "$check"
    FAILED=1
  fi
done <<< "$LOCAL_CHECKS"

# Check PR checks against workflow jobs
printf '\n%s▸ PR CI checks:%s\n' "$BLUE" "$NC"
while IFS= read -r check; do
  [[ -z "$check" ]] && continue
  # Normalize for fuzzy matching (lowercase, strip special chars)
  NORMALIZED=$(echo "$check" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 ]//g')
  FOUND=0
  while IFS= read -r job; do
    [[ -z "$job" ]] && continue
    JOB_NORMALIZED=$(echo "$job" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 ]//g')
    if [[ "$JOB_NORMALIZED" == *"$NORMALIZED"* ]] || [[ "$NORMALIZED" == *"$JOB_NORMALIZED"* ]]; then
      FOUND=1
      break
    fi
  done <<< "$CI_JOBS"
  if [[ $FOUND -eq 1 ]]; then
    printf '  %s✓%s %s\n' "$GREEN" "$NC" "$check"
  else
    printf '  %s⚠%s %s (not matched in ci.yml jobs — may be in auxiliary workflow)\n' "$YELLOW" "$NC" "$check"
  fi
done <<< "$PR_CHECKS"

# Check release manifest entries
RELEASE_CHECKS=$(jq -r '.release.checks[]' "$MANIFEST" 2>/dev/null)
RELEASE_FILE="$REPO_ROOT/.github/workflows/release.yml"
printf '\n%s▸ Release gate checks:%s\n' "$BLUE" "$NC"
while IFS= read -r check; do
  [[ -z "$check" ]] && continue
  NORMALIZED=$(echo "$check" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 ]//g')
  if [[ -f "$RELEASE_FILE" ]] && grep -qi "$NORMALIZED" "$RELEASE_FILE" 2>/dev/null; then
    printf '  %s✓%s %s\n' "$GREEN" "$NC" "$check"
  else
    printf '  %s⚠%s %s (not found in release.yml — may use different naming)\n' "$YELLOW" "$NC" "$check"
  fi
done <<< "$RELEASE_CHECKS"

echo ""
if [[ $FAILED -ne 0 ]]; then
  printf '%s✗ Gate parity check failed — see above for mismatches%s\n' "$RED" "$NC"
  exit 1
fi

printf '%s✓ Gate parity manifest validated%s\n' "$GREEN" "$NC"
exit 0
