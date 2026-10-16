#!/usr/bin/env bats
# BATS tests for scripts/release/check-release-notes.sh (GOAP-276 Phase 1).
# Each case runs the real script against a fixture changelog.

setup() {
    SCRIPT="$BATS_TEST_DIRNAME/../release/check-release-notes.sh"
    TMP_DIR="$BATS_TEST_TMPDIR/notes"
    mkdir -p "$TMP_DIR"
}

@test "self-test passes" {
    run "$SCRIPT" --self-test
    [ "$status" -eq 0 ]
}

@test "accepts a well-formed release section" {
    printf '## [2.0.0] - 2026-10-18\n\n- feat: x\n\n### Breaking Changes\nNone.\n' > "$TMP_DIR/ok.md"
    run "$SCRIPT" 2.0.0 --file "$TMP_DIR/ok.md"
    [ "$status" -eq 0 ]
}

@test "rejects an empty Breaking Changes section" {
    printf '## [2.0.0] - 2026-10-18\n\n- feat: x\n\n### Breaking Changes\n\n### Other\n- y\n' > "$TMP_DIR/bc.md"
    run "$SCRIPT" 2.0.0 --file "$TMP_DIR/bc.md"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Breaking Changes section is present but empty"* ]]
}

@test "rejects a surviving TODO placeholder" {
    printf '## [2.0.0] - 2026-10-18\n\n- feat: TODO describe\n' > "$TMP_DIR/todo.md"
    run "$SCRIPT" 2.0.0 --file "$TMP_DIR/todo.md"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Surviving draft placeholder"* ]]
}

@test "rejects a missing release header date" {
    printf '## Version 2.0.0\n\n- feat: x\n' > "$TMP_DIR/hdr.md"
    run "$SCRIPT" 2.0.0 --file "$TMP_DIR/hdr.md"
    [ "$status" -eq 1 ]
}

@test "fails when the requested version section is absent" {
    printf '## [1.0.0] - 2026-01-01\n\n- feat: x\n' > "$TMP_DIR/other.md"
    run "$SCRIPT" 9.9.9 --file "$TMP_DIR/other.md"
    [ "$status" -eq 1 ]
    [[ "$output" == *"not found"* ]]
}

@test "does not treat version dots as regex wildcards" {
    printf '## [1x0x0] - 2026-01-01\n\n- feat: x\n' > "$TMP_DIR/wild.md"
    run "$SCRIPT" 1.0.0 --file "$TMP_DIR/wild.md"
    [ "$status" -eq 1 ]
    [[ "$output" == *"not found"* ]]
}

@test "validates the real CHANGELOG 0.1.0 section" {
    run "$SCRIPT" 0.1.0
    [ "$status" -eq 0 ]
}
