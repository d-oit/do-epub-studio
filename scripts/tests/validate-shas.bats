#!/usr/bin/env bats
# BATS tests for scripts/validate-shas.sh — the action-SHA allowlist.

setup() {
    SCRIPT="$BATS_TEST_DIRNAME/../validate-shas.sh"
    # Load the allowlist + is_allowed_sha() function
    # shellcheck disable=SC1090
    source "$SCRIPT"
}

@test "allowlist contains the approved ossf/scorecard-action SHA (v2.4.4)" {
    is_allowed_sha "ossf/scorecard-action@2d1146689b8cda280b9bc96326124645441f03bc"
}

@test "allowlist still contains the prior scorecard-action SHA" {
    is_allowed_sha "ossf/scorecard-action@55891bbd73f2425e97637d96e306fc9d491d0b21"
}

@test "is_allowed_sha returns 0 for any known allowlisted action" {
    allowed="actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1"
    run is_allowed_sha "$allowed"
    [ "$status" -eq 0 ]
}

@test "is_allowed_sha rejects an arbitrary unknown SHA" {
    run is_allowed_sha "ossf/scorecard-action@ffffffffffffffffffffffffffffffffffffffff"
    [ "$status" -eq 1 ]
}

@test "is_allowed_sha rejects an unknown action entirely" {
    run is_allowed_sha "evil-private/action@2d1146689b8cda280b9bc96326124645441f03bc"
    [ "$status" -eq 1 ]
}

@test "scorecard workflow pins the new scorecard-action SHA" {
    WORKFLOW="$BATS_TEST_DIRNAME/../../.github/workflows/scorecard.yml"
    grep -qE "uses: ossf/scorecard-action@2d1146689b8cda280b9bc96326124645441f03bc" "$WORKFLOW"
}
