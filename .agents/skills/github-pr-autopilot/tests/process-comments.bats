#!/usr/bin/env bats
# BATS tests for process-comments.sh — argument validation and comprehensive
# feedback processing (inline review comments, issue comments, formal reviews)

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
    run grep "done < <(" "$SCRIPT"
    [ "$status" -eq 0 ]
}

@test "process-comments.sh has shebang" {
    run head -1 "$SCRIPT"
    [[ "$output" == "#!/bin/bash" ]]
}

@test "process-comments.sh fetches inline review comments endpoint" {
    run grep -q "pulls/.*comments" "$SCRIPT"
    [ "$status" -eq 0 ]
}

@test "process-comments.sh fetches issue comments endpoint" {
    run grep -q "issues" "$SCRIPT"
    [ "$status" -eq 0 ]
}

@test "process-comments.sh fetches formal reviews" {
    run grep -q "reviews" "$SCRIPT"
    [ "$status" -eq 0 ]
}

@test "process-comments.sh has self-learning phase" {
    run grep -q "Self-learning" "$SCRIPT"
    [ "$status" -eq 0 ]
}

@test "process-comments.sh tracks all 3 feedback types in summary" {
    run grep -q 'All feedback analyzed' "$SCRIPT"
    [ "$status" -eq 0 ]
}
