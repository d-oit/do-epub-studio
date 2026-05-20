#!/usr/bin/env bats
# BATS tests for process-comments.sh — argument validation and comment classification

setup() {
    SCRIPT="$BATS_TEST_DIRNAME/../scripts/process-comments.sh"
}

@test "process-comments.sh exists and is executable" {
    [ -f "$SCRIPT" ]
    [ -x "$SCRIPT" ]
}

@test "process-comments.sh exits with error when no PR number provided" {
    run bash "$SCRIPT"
    [ "$status" -ne 0 ]
    [[ "$output" == *"Usage:"* ]]
}

@test "process-comments.sh has set -euo pipefail" {
    run head -3 "$SCRIPT"
    [[ "$output" == *"set -euo pipefail"* ]]
}

@test "process-comments.sh uses process substitution not pipe for while loop" {
    # The subshell bug fix: must use '< <(...)' not '| while read ...'
    run grep "done < <(" "$SCRIPT"
    [ "$status" -eq 0 ]
}

@test "process-comments.sh has shebang" {
    run head -1 "$SCRIPT"
    [[ "$output" == "#!/bin/bash" ]]
}
