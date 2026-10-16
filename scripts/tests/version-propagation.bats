#!/usr/bin/env bats
# BATS tests for scripts/release/version-propagation.sh
# Validates semver enforcement, argument parsing, dry-run, and version propagation.

setup() {
    SCRIPT="$BATS_TEST_DIRNAME/../release/version-propagation.sh"
    TEST_TMP="${BATS_TEST_TMPDIR:-${TMPDIR:-/tmp}}/version-test-$$"
    mkdir -p "$TEST_TMP"
}

teardown() {
    rm -rf "$TEST_TMP"
}

@test "version-propagation: fails when no version argument provided" {
    run "$SCRIPT"
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Version argument required" ]]
}

@test "version-propagation: displays help with --help" {
    run "$SCRIPT" --help
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Usage:" ]]
}

@test "version-propagation: rejects invalid semver strings" {
    run "$SCRIPT" "not-a-version"
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid semver format" ]]

    run "$SCRIPT" "1.2"
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid semver format" ]]

    run "$SCRIPT" "1.2.3.4"
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid semver format" ]]
}

@test "version-propagation: accepts version with leading v" {
    run "$SCRIPT" "v0.1.0" --dry-run
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Propagating version 0.1.0" ]]
}

@test "version-propagation: --dry-run does not modify VERSION file" {
    orig_version=$(cat "$BATS_TEST_DIRNAME/../../VERSION")
    run "$SCRIPT" "0.99.99" --dry-run
    [ "$status" -eq 0 ]
    current_version=$(cat "$BATS_TEST_DIRNAME/../../VERSION")
    [ "$orig_version" = "$current_version" ]
}

@test "version-propagation: updates package.json and VERSION correctly in isolated dir" {
    # Create isolated repo structure with matching depth (scripts/release/)
    mkdir -p "$TEST_TMP/scripts/lib" "$TEST_TMP/scripts/release"
    cp "$BATS_TEST_DIRNAME/../lib/colors.sh" "$TEST_TMP/scripts/lib/"
    cp "$SCRIPT" "$TEST_TMP/scripts/release/version-propagation.sh"
    chmod +x "$TEST_TMP/scripts/release/version-propagation.sh"
    cat > "$TEST_TMP/package.json" <<'JSON'
{
  "name": "root",
  "version": "0.1.0",
  "dependencies": {
    "@do-epub-studio/shared": "workspace:^0.1.0"
  }
}
JSON

    # Run in isolated dir without check-app-identity verification
    cd "$TEST_TMP"
    run ./scripts/release/version-propagation.sh "0.2.0" --no-verify
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Version propagation to 0.2.0 complete" ]]

    # Assert VERSION updated
    [ "$(cat "$TEST_TMP/VERSION")" = "0.2.0" ]

    # Assert package.json updated
    pkg_ver=$(node -e "console.log(require('$TEST_TMP/package.json').version)")
    [ "$pkg_ver" = "0.2.0" ]

    dep_ver=$(node -e "console.log(require('$TEST_TMP/package.json').dependencies['@do-epub-studio/shared'])")
    [ "$dep_ver" = "workspace:^0.2.0" ]
}
