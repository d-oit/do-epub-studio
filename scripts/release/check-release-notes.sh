#!/usr/bin/env bash
# scripts/release/check-release-notes.sh — Release-notes shape enforcement (GOAP-276 Phase 1).
# Validates release section header, conventional sections, explicit None. breaking changes,
# and detects surviving placeholders.
#
# Usage:
#   scripts/release/check-release-notes.sh [version] [--file <path>]
#   scripts/release/check-release-notes.sh --self-test
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source colors if available
if [[ -f "$REPO_ROOT/scripts/lib/colors.sh" ]]; then
  # shellcheck source=scripts/lib/colors.sh
  source "$REPO_ROOT/scripts/lib/colors.sh"
else
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  NC='\033[0m'
fi

FILE="$REPO_ROOT/CHANGELOG.md"
VERSION=""
SELF_TEST=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --self-test)
      SELF_TEST=true
      shift
      ;;
    --file)
      FILE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [version] [--file <path>] [--self-test]"
      echo "  version      Release version (e.g., 0.1.0; defaults to VERSION file)"
      echo "  --file       Path to changelog or release notes file (default: CHANGELOG.md)"
      echo "  --self-test  Run internal validation tests against fixtures"
      exit 0
      ;;
    *)
      if [[ -z "$VERSION" ]]; then
        VERSION="$1"
      else
        printf '%s✗ Unexpected argument: %s%s\n' "$RED" "$1" "$NC" >&2
        exit 1
      fi
      shift
      ;;
  esac
done

# --- Self-test mode ---
run_self_test() {
  printf 'Running check-release-notes self-test suite...\n'
  local tmp_dir
  tmp_dir=$(mktemp -d)
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp_dir'" RETURN

  # Valid fixture with Breaking Changes: None.
  cat > "$tmp_dir/valid.md" <<'MD'
## [1.0.0] - 2026-10-18

### Features
- feat(reader): add offline chapter search

### Bug Fixes
- fix(worker): sanitize exported markdown annotations

### Breaking Changes
None.
MD

  # Invalid: surviving placeholder
  cat > "$tmp_dir/placeholder.md" <<'MD'
## [1.0.0] - 2026-10-18

### Features
- feat(reader): TODO add details
MD

  # Invalid: bad header format
  cat > "$tmp_dir/bad_header.md" <<'MD'
## Version 1.0.0 (October 2026)

- feat: something
MD

  # Invalid: empty section
  cat > "$tmp_dir/empty.md" <<'MD'
## [1.0.0] - 2026-10-18

MD

  # 1. Valid fixture must pass
  if ! validate_content "$(cat "$tmp_dir/valid.md")" "1.0.0" >/dev/null 2>&1; then
    printf '%s✗ Self-test failed: valid fixture was rejected%s\n' "$RED" "$NC" >&2
    return 1
  fi

  # 2. Placeholder fixture must fail
  if validate_content "$(cat "$tmp_dir/placeholder.md")" "1.0.0" >/dev/null 2>&1; then
    printf '%s✗ Self-test failed: placeholder fixture was accepted%s\n' "$RED" "$NC" >&2
    return 1
  fi

  # 3. Bad header must fail
  if validate_content "$(cat "$tmp_dir/bad_header.md")" "1.0.0" >/dev/null 2>&1; then
    printf '%s✗ Self-test failed: bad header fixture was accepted%s\n' "$RED" "$NC" >&2
    return 1
  fi

  # 4. Empty content must fail
  if validate_content "$(cat "$tmp_dir/empty.md")" "1.0.0" >/dev/null 2>&1; then
    printf '%s✗ Self-test failed: empty content fixture was accepted%s\n' "$RED" "$NC" >&2
    return 1
  fi

  printf '%s✓ check-release-notes self-test passed (4/4 fixture assertions)%s\n' "$GREEN" "$NC"
  return 0
}

# --- Core Validation Logic ---
validate_content() {
  local content="$1"
  local target_ver="$2"
  local errors=0

  # Check 1: Header format
  local header_pattern="^##[[:space:]]+\[${target_ver}\][[:space:]]+-[[:space:]]+[0-9]{4}-[0-9]{2}-[0-9]{2}"
  if ! echo "$content" | grep -qE "$header_pattern"; then
    printf '%s✗ Missing or invalid release header for [%s]. Expected: ## [%s] - YYYY-MM-DD%s\n' "$RED" "$target_ver" "$target_ver" "$NC" >&2
    errors=$((errors + 1))
  fi

  # Check 2: Surviving placeholders
  if echo "$content" | grep -qE '\b(TODO|TBD|FIXME|XXX)\b|<placeholder>|<!--[[:space:]]*placeholder[[:space:]]*-->'; then
    printf '%s✗ Surviving draft placeholder detected in release notes%s\n' "$RED" "$NC" >&2
    errors=$((errors + 1))
  fi

  # Check 3: Non-empty release content (must have at least one bullet point or description line)
  local bullet_count
  bullet_count=$(echo "$content" | grep -c '^[[:space:]]*- ' || true)
  if [[ $bullet_count -eq 0 ]]; then
    printf '%s✗ Release notes contain no change entries (no bullet items found)%s\n' "$RED" "$NC" >&2
    errors=$((errors + 1))
  fi

  # Check 4: Breaking Changes section must not be empty if present
  if echo "$content" | grep -qi '###[[:space:]]*Breaking Changes'; then
    local bc_block
    bc_block=$(echo "$content" | awk '/###[[:space:]]*Breaking Changes/{flag=1;next}/###/{flag=0}flag')
    if [[ -z "$(echo "$bc_block" | tr -d '[:space:]')" ]]; then
      printf '%s✗ Breaking Changes section is present but empty. State changes or write explicit "None."%s\n' "$RED" "$NC" >&2
      errors=$((errors + 1))
    fi
  fi

  return "$errors"
}

if [[ "$SELF_TEST" == "true" ]]; then
  run_self_test
  exit 0
fi

# Default version to VERSION file if not passed
if [[ -z "$VERSION" ]]; then
  if [[ -f "$REPO_ROOT/VERSION" ]]; then
    VERSION=$(tr -d '[:space:]' < "$REPO_ROOT/VERSION")
  else
    printf '%s✗ VERSION file not found and no version argument provided%s\n' "$RED" "$NC" >&2
    exit 1
  fi
fi

# Strip leading v
VERSION="${VERSION#v}"

if [[ ! -f "$FILE" ]]; then
  printf '%s✗ Release notes file not found: %s%s\n' "$RED" "$FILE" "$NC" >&2
  exit 1
fi

printf 'Checking release notes for %s in %s...\n' "$VERSION" "$FILE"

# Extract section for the target version. The header is matched literally
# (prefix "## [VER]") so regex metacharacters in a version cannot misfire.
SECTION_CONTENT=$(awk -v hdr="## [${VERSION}]" '
  index($0, hdr) == 1 { capturing=1; print; next }
  capturing && /^## \[/ { exit }
  capturing { print }
' "$FILE")

if [[ -z "$SECTION_CONTENT" ]]; then
  printf '%s✗ Release section for [%s] not found in %s%s\n' "$RED" "$VERSION" "$FILE" "$NC" >&2
  exit 1
fi

if ! validate_content "$SECTION_CONTENT" "$VERSION"; then
  printf '%s✗ Release notes shape validation failed for [%s]%s\n' "$RED" "$VERSION" "$NC" >&2
  exit 1
fi
# Advisory dropped-PR report: PRs merged since the latest tag whose number is
# not cited in the section. Never changes the exit status (user-chosen mode).
report_dropped_prs() {
  local section="$1"
  local last_tag range_log merged uncited=()
  last_tag=$(git -C "$REPO_ROOT" describe --tags --abbrev=0 HEAD 2>/dev/null || true)
  if [[ -z "$last_tag" ]]; then
    return 0
  fi
  range_log=$(git -C "$REPO_ROOT" log --format=%s "${last_tag}..HEAD" 2>/dev/null || true)
  merged=$(printf '%s\n' "$range_log" | grep -oE '\(#[0-9]+\)' | tr -d '()#' | sort -un || true)
  while IFS= read -r num; do
    [[ -z "$num" ]] && continue
    if ! grep -qE "#${num}([^0-9]|$)" <<<"$section"; then
      uncited+=("$num")
    fi
  done <<<"$merged"
  if [[ ${#uncited[@]} -gt 0 ]]; then
    local refs=""
    for num in "${uncited[@]}"; do refs+=" #${num}"; done
    printf '%s! Advisory: %d PR(s) merged since %s not cited in [%s]:%s%s\n' \
      "$YELLOW" "${#uncited[@]}" "$last_tag" "$VERSION" "$refs" "$NC"
  fi
  return 0
}

report_dropped_prs "$SECTION_CONTENT"

printf '%s✓ Release notes for [%s] valid.%s\n' "$GREEN" "$VERSION" "$NC"
