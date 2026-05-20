#!/usr/bin/env bats
# BATS tests for autopilot.sh — argument validation, label detection, sensitive file check

setup() {
    SCRIPT="$BATS_TEST_DIRNAME/../scripts/autopilot.sh"
}

@test "autopilot.sh exists and is executable" {
    [ -f "$SCRIPT" ]
    [ -x "$SCRIPT" ]
}

@test "autopilot.sh exits with error when no PR number provided" {
    run bash "$SCRIPT"
    [ "$status" -ne 0 ]
    [[ "$output" == *"Usage:"* ]]
}

@test "autopilot.sh checks for protected labels" {
    # Verify the label-check pattern exists in the script
    run grep -q "release:cut\|WIP\|DO NOT MERGE" "$SCRIPT"
    [ "$status" -eq 0 ]
}

@test "autopilot.sh checks for sensitive files" {
    # Verify sensitive file pattern exists
    run grep -q "auth\|security\|permission\|argon2\|session\|token\|secret" "$SCRIPT"
    [ "$status" -eq 0 ]
}

@test "autopilot.sh has MAX_ITER limit" {
    run grep -q "MAX_ITER=10" "$SCRIPT"
    [ "$status" -eq 0 ]
}

@test "autopilot.sh merges with --squash --delete-branch" {
    run grep -q "squash.*delete-branch" "$SCRIPT"
    [ "$status" -eq 0 ]
}

@test "autopilot.sh has set -euo pipefail" {
    run head -3 "$SCRIPT"
    [[ "$output" == *"set -euo pipefail"* ]]
}

@test "autopilot.sh has shebang" {
    run head -1 "$SCRIPT"
    [[ "$output" == "#!/bin/bash" ]]
}
