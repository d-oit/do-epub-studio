#!/usr/bin/env bats

setup() {
    HELPER="$BATS_TEST_DIRNAME/../lib/quality_gate_language_detection.sh"
    PROJECT="$BATS_TEST_TMPDIR/project"
    mkdir -p "$PROJECT"
    for ((i = 0; i < 5000; i++)); do
        printf -v basename '%05d' "$i"
        : > "$PROJECT/$basename.sh"
        : > "$PROJECT/$basename.md"
    done
}

@test "language detection stops after one match without find pipe warnings" {
    run bash -c 'set -euo pipefail; cd "$1"; source "$2"; quality_gate_has_file "*.sh"; quality_gate_has_file "*.md"' _ "$PROJECT" "$HELPER"

    [ "$status" -eq 0 ]
    [ -z "$output" ]
}
