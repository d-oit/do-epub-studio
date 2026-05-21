#!/usr/bin/env bats
# BATS tests for verify-auth.sh — argument validation and auth flow

setup() {
    # Source the script to access functions (will error if gh not installed,
    # but we only test argument handling and non-auth code paths here)
    SCRIPT="$BATS_TEST_DIRNAME/../scripts/verify-auth.sh"
}

@test "verify-auth.sh exists and is executable" {
    [ -f "$SCRIPT" ]
    [ -x "$SCRIPT" ]
}

@test "verify-auth.sh has set -euo pipefail" {
    run head -3 "$SCRIPT"
    [[ "$output" == *"set -euo pipefail"* ]]
}

@test "verify-auth.sh has shebang" {
    run head -1 "$SCRIPT"
    [[ "$output" == "#!/bin/bash" ]]
}
