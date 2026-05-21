#!/usr/bin/env bats
# BATS tests for resolve-conflicts.sh — argument validation and conflict analysis

setup() {
    SCRIPT="$BATS_TEST_DIRNAME/../scripts/resolve-conflicts.sh"
}

@test "resolve-conflicts.sh exists and is executable" {
    [ -f "$SCRIPT" ]
    [ -x "$SCRIPT" ]
}

@test "resolve-conflicts.sh exits with error when no PR number provided" {
    run bash "$SCRIPT"
    [ "$status" -ne 0 ]
    [[ "$output" == *"Usage:"* ]]
}

@test "resolve-conflicts.sh has set -euo pipefail" {
    run head -3 "$SCRIPT"
    [[ "$output" == *"set -euo pipefail"* ]]
}

@test "resolve-conflicts.sh has shebang" {
    run head -1 "$SCRIPT"
    [[ "$output" == "#!/bin/bash" ]]
}
