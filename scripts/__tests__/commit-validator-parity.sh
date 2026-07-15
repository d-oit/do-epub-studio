#!/usr/bin/env bash
# Commit validator parity tests.
# Ensures all commit validators (commit.sh, hooks/commit-msg, validate-commit-message.sh)
# agree on which messages are valid or invalid.
#
# Run: bash scripts/__tests__/commit-validator-parity.sh
# Exit 0 = all validators agree, Exit 1 = drift detected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source shared types
source "$REPO_ROOT/scripts/lib/commit-types.sh"

PASS=0
FAIL=0
DRIFT=0

TMPDIR_PARITY=$(mktemp -d)
trap 'rm -rf "$TMPDIR_PARITY"' EXIT

# Test a message against the commit-msg hook
test_hook() {
    local msg="$1"
    local msgfile="$TMPDIR_PARITY/commit-msg-test"
    printf '%s\n\n%s\n' "$msg" "Body explaining why" > "$msgfile"
    if bash "$REPO_ROOT/scripts/hooks/commit-msg" "$msgfile" >/dev/null 2>&1; then
        echo "pass"
    else
        echo "fail"
    fi
}

# Test a message against validate-commit-message.sh
test_validate() {
    local msg="$1"
    local msgfile="$TMPDIR_PARITY/commit-msg-test"
    printf '%s\n\n%s\n' "$msg" "Body explaining why" > "$msgfile"
    if bash "$REPO_ROOT/scripts/validate-commit-message.sh" "$msgfile" >/dev/null 2>&1; then
        echo "pass"
    else
        echo "fail"
    fi
}

# Test a message against the regex directly (simulates commit.sh validation)
test_regex() {
    local msg="$1"
    if echo "$msg" | grep -qE "$CONVENTIONAL_REGEX"; then
        echo "pass"
    else
        echo "fail"
    fi
}

assert_all_agree() {
    local description="$1"
    local msg="$2"
    local expected="$3"  # pass or fail

    local hook_result validate_result regex_result
    hook_result=$(test_hook "$msg")
    validate_result=$(test_validate "$msg")
    regex_result=$(test_regex "$msg")

    local ok=true

    # Check if all agree
    if [[ "$hook_result" != "$validate_result" ]] || \
       [[ "$validate_result" != "$regex_result" ]]; then
        echo "✗ DRIFT: $description"
        echo "  hook=$hook_result validate=$validate_result regex=$regex_result"
        echo "  message: $msg"
        ok=false
        DRIFT=$((DRIFT + 1))
    fi

    # Check if result matches expected
    if [[ "$hook_result" != "$expected" ]]; then
        echo "✗ FAIL: $description (expected=$expected, got=$hook_result)"
        echo "  message: $msg"
        ok=false
        FAIL=$((FAIL + 1))
    fi

    if $ok; then
        PASS=$((PASS + 1))
    fi
}

echo "Running commit validator parity tests..."
echo ""

# --- Valid messages (all validators should accept) ---
echo "=== Valid messages ==="
for type in "${COMMIT_TYPES[@]}"; do
    assert_all_agree "type=$type" "$type: do something" "pass"
done

assert_all_agree "type with scope" "feat(reader): add highlighting" "pass"
assert_all_agree "type with breaking" "feat(api)!: remove deprecated endpoint" "pass"
assert_all_agree "type web scope" "fix(web): resolve layout issue" "pass"
assert_all_agree "type worker scope" "ci(worker): add deployment check" "pass"
assert_all_agree "type plans scope" "docs(plans): update GOAP plan" "pass"

# --- Invalid messages (all validators should reject) ---
echo ""
echo "=== Invalid messages ==="
assert_all_agree "empty message" "" "fail"
assert_all_agree "no type" "just a description" "fail"
assert_all_agree "unknown type" "unknown: do something" "fail"
assert_all_agree "uppercase type" "Feat: add feature" "fail"
assert_all_agree "missing colon" "feat add feature" "fail"
assert_all_agree "missing description" "feat: " "fail"
assert_all_agree "type with uppercase in scope" "feat(MyScope): fix" "fail"

# --- Special commits ---
# Note: Revert/fixup/WIP are handled by hook and validate as skip-before-regex.
# commit.sh's regex doesn't match them (git handles reverts natively).
# These are NOT tested for parity because the regex validator legitimately differs.
echo ""
echo "=== Special commits (informational) ==="
# Verify hook accepts Revert
hook_revert=$(test_hook 'Revert "feat(x): something"')
validate_revert=$(test_validate 'Revert "feat(x): something"')
if [[ "$hook_revert" == "pass" ]] && [[ "$validate_revert" == "pass" ]]; then
    echo "✓ Revert commits accepted by hook and validate"
    PASS=$((PASS + 1))
else
    echo "✗ Revert commit handling drift: hook=$hook_revert validate=$validate_revert"
    DRIFT=$((DRIFT + 1))
fi

# --- Summary ---
echo ""
echo "=== Results ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Drift:  $DRIFT"

if [[ $DRIFT -gt 0 ]]; then
    echo ""
    echo "✗ Validator drift detected — validators disagree on message validity!"
    echo "  Ensure all validators source scripts/lib/commit-types.sh"
    exit 1
fi

if [[ $FAIL -gt 0 ]]; then
    echo ""
    echo "✗ Some assertions failed"
    exit 1
fi

echo ""
echo "✓ All commit validators agree — no drift detected"
exit 0
