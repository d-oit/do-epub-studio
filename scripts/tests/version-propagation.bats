#!/usr/bin/env bats
# BATS tests for scripts/release/version-propagation.sh
# Validates semver enforcement, argument parsing, dry-run, and version propagation.

setup() {
    SCRIPT="$BATS_TEST_DIRNAME/../release/version-propagation.sh"
    HELPER="$BATS_TEST_DIRNAME/../lib/workspace-manifests.mjs"
    TEST_TMP="${BATS_TEST_TMPDIR:-${TMPDIR:-/tmp}}/version-test-$$"
    mkdir -p "$TEST_TMP"
}
teardown() {
    rm -rf "$TEST_TMP"
}

prepare_release_layout() {
    mkdir -p "$TEST_TMP/scripts/lib" "$TEST_TMP/scripts/release"
    cp "$BATS_TEST_DIRNAME/../lib/colors.sh" "$TEST_TMP/scripts/lib/"
    cp "$HELPER" "$TEST_TMP/scripts/lib/workspace-manifests.mjs"
    cp "$SCRIPT" "$TEST_TMP/scripts/release/version-propagation.sh"
    chmod +x "$TEST_TMP/scripts/release/version-propagation.sh"
    printf '0.1.0\n' > "$TEST_TMP/VERSION"
    cat > "$TEST_TMP/package.json" <<'JSON'
{"name":"root","version":"0.1.0","dependencies":{"@do-epub-studio/shared":"workspace:^0.1.0"}}
JSON
    cat > "$TEST_TMP/scripts/check-app-identity.mjs" <<'NODE'
process.exit(0);
NODE
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
    [[ "$output" == *"Propagating version 0.1.0"* ]]
}

@test "version-propagation: --dry-run does not modify VERSION file" {
    orig_version=$(cat "$BATS_TEST_DIRNAME/../../VERSION")
    run "$SCRIPT" "0.99.99" --dry-run
    [ "$status" -eq 0 ]
    current_version=$(cat "$BATS_TEST_DIRNAME/../../VERSION")
    [ "$orig_version" = "$current_version" ]
}

@test "workspace manifest CLI includes root and immediate workspaces only" {
    FIXTURE="$TEST_TMP/workspace-scope"
    mkdir -p "$FIXTURE/apps/web/fixtures" \
        "$FIXTURE/packages/shared/node_modules/example" \
        "$FIXTURE/packages/submodule/.git" "$FIXTURE/tools/helper" \
        "$FIXTURE/.impeccable/scripts"
    printf '{"name":"root"}\n' > "$FIXTURE/package.json"
    printf '{"name":"web"}\n' > "$FIXTURE/apps/web/package.json"
    printf '{"name":"shared"}\n' > "$FIXTURE/packages/shared/package.json"
    printf '{ malformed nested fixture\n' > "$FIXTURE/apps/web/fixtures/package.json"
    printf '{ malformed node_modules fixture\n' > "$FIXTURE/packages/shared/node_modules/example/package.json"
    printf '{ malformed submodule manifest\n' > "$FIXTURE/packages/submodule/package.json"
    printf '{ malformed tool manifest\n' > "$FIXTURE/tools/helper/package.json"
    printf '{ malformed submodule tool manifest\n' > "$FIXTURE/.impeccable/scripts/package.json"

    run node "$HELPER" "$FIXTURE"
    [ "$status" -eq 0 ]
    [ "$output" = $'./package.json\n./apps/web/package.json\n./packages/shared/package.json' ]
}


@test "workspace manifest CLI ignores symlinked workspaces and rejects symlinked manifests" {
    FIXTURE="$TEST_TMP/symlink-manifest"
    mkdir -p "$FIXTURE/apps" "$FIXTURE/packages/shared" "$FIXTURE/external"
    printf '{"name":"root"}\n' > "$FIXTURE/package.json"
    printf '{"name":"shared"}\n' > "$FIXTURE/packages/shared/package.json"
    printf '{"name":"linked"}\n' > "$FIXTURE/external/package.json"
    ln -s "$FIXTURE/external" "$FIXTURE/apps/linked-workspace"

    run node "$HELPER" "$FIXTURE"
    [ "$status" -eq 0 ]
    [ "$output" = $'./package.json\n./packages/shared/package.json' ]

    mkdir -p "$FIXTURE/apps/linked-manifest"
    ln -s "$FIXTURE/external/package.json" "$FIXTURE/apps/linked-manifest/package.json"
    run node "$HELPER" "$FIXTURE"
    [ "$status" -eq 1 ]
    rm "$FIXTURE/apps/linked-manifest/package.json"
    ln -s "$FIXTURE/external/missing-package.json" "$FIXTURE/apps/linked-manifest/package.json"
    run node "$HELPER" "$FIXTURE"
    [ "$status" -eq 1 ]
}

@test "workspace manifest CLI rejects symlinked top-level workspace roots" {
    FIXTURE="$TEST_TMP/symlinked-workspace-root"
    mkdir -p "$FIXTURE/external/apps"
    printf '{"name":"root"}\n' > "$FIXTURE/package.json"
    ln -s "$FIXTURE/external/apps" "$FIXTURE/apps"

    run node "$HELPER" "$FIXTURE"
    [ "$status" -eq 1 ]
}

@test "workspace manifest CLI treats missing apps and packages as empty" {
    FIXTURE="$TEST_TMP/without-workspaces"
    mkdir -p "$FIXTURE"
    printf '{"name":"root"}\n' > "$FIXTURE/package.json"

    run node "$HELPER" "$FIXTURE"
    [ "$status" -eq 0 ]
    [ "$output" = "./package.json" ]
}

@test "workspace manifest CLI rejects missing or malformed root package manifests" {
    FIXTURE="$TEST_TMP/root-invalid"
    mkdir -p "$FIXTURE"

    run node "$HELPER" "$FIXTURE"
    [ "$status" -eq 1 ]


    printf '{ malformed root\n' > "$FIXTURE/package.json"
    run node "$HELPER" "$FIXTURE"
    [ "$status" -eq 1 ]

    mkdir -p "$FIXTURE/external"
    printf '{"name":"external"}\n' > "$FIXTURE/external/package.json"
    rm "$FIXTURE/package.json"
    ln -s "$FIXTURE/external/package.json" "$FIXTURE/package.json"
    run node "$HELPER" "$FIXTURE"
    [ "$status" -eq 1 ]
}

@test "version-propagation changes only scoped manifests and dry-run changes no bytes" {
    prepare_release_layout
    mkdir -p "$TEST_TMP/apps/web" "$TEST_TMP/packages/shared" \
        "$TEST_TMP/tools/helper" "$TEST_TMP/apps/web/fixtures" \
        "$TEST_TMP/packages/shared/dist" \
        "$TEST_TMP/packages/shared/node_modules/example" \
        "$TEST_TMP/packages/submodule/.git" "$TEST_TMP/.impeccable/scripts"
    cat > "$TEST_TMP/apps/web/package.json" <<'JSON'
{"name":"web","version":"0.1.0","dependencies":{"@do-epub-studio/shared":"workspace:~0.1.0"}}
JSON
    cat > "$TEST_TMP/packages/shared/package.json" <<'JSON'
{"name":"shared","version":"0.1.0"}
JSON
    printf '{ malformed nested fixture\n' > "$TEST_TMP/apps/web/fixtures/package.json"
    printf '{ malformed dist fixture\n' > "$TEST_TMP/packages/shared/dist/package.json"
    printf '{ malformed node_modules fixture\n' > "$TEST_TMP/packages/shared/node_modules/example/package.json"
    printf '{ malformed submodule manifest\n' > "$TEST_TMP/packages/submodule/package.json"
    printf '{ malformed tool manifest\n' > "$TEST_TMP/tools/helper/package.json"
    printf '{ malformed impeccable fixture\n' > "$TEST_TMP/.impeccable/scripts/package.json"
    cp -a "$TEST_TMP" "$TEST_TMP.before"

    cd "$TEST_TMP"
    run ./scripts/release/version-propagation.sh "0.2.0" --dry-run
    [ "$status" -eq 0 ]
    [[ "$output" == *"Would update ./apps/web/package.json version to 0.2.0"* ]]
    [[ "$output" == *"Would update ./packages/shared/package.json version to 0.2.0"* ]]
    [[ "$output" == *"Updated 3 package.json file(s)."* ]]
    diff -qr "$TEST_TMP.before" "$TEST_TMP"
    [ "$(cat "$TEST_TMP/VERSION")" = "0.1.0" ]

    run ./scripts/release/version-propagation.sh "0.2.0"
    [ "$status" -eq 0 ]
    [[ "$output" == *"Version propagation to 0.2.0 complete"* ]]
    [ "$(cat "$TEST_TMP/VERSION")" = "0.2.0" ]
    [ "$(node -e "console.log(require('$TEST_TMP/package.json').version)")" = "0.2.0" ]
    [ "$(node -e "console.log(require('$TEST_TMP/package.json').dependencies['@do-epub-studio/shared'])")" = "workspace:^0.2.0" ]
    [ "$(node -e "console.log(require('$TEST_TMP/apps/web/package.json').version)")" = "0.2.0" ]
    [ "$(node -e "console.log(require('$TEST_TMP/apps/web/package.json').dependencies['@do-epub-studio/shared'])")" = "workspace:~0.2.0" ]
    [ "$(node -e "console.log(require('$TEST_TMP/packages/shared/package.json').version)")" = "0.2.0" ]
    cmp -s "$TEST_TMP/tools/helper/package.json" "$TEST_TMP.before/tools/helper/package.json"
    cmp -s "$TEST_TMP/apps/web/fixtures/package.json" "$TEST_TMP.before/apps/web/fixtures/package.json"
    cmp -s "$TEST_TMP/packages/shared/dist/package.json" "$TEST_TMP.before/packages/shared/dist/package.json"
    cmp -s "$TEST_TMP/packages/shared/node_modules/example/package.json" "$TEST_TMP.before/packages/shared/node_modules/example/package.json"
    cmp -s "$TEST_TMP/packages/submodule/package.json" "$TEST_TMP.before/packages/submodule/package.json"
    cmp -s "$TEST_TMP/.impeccable/scripts/package.json" "$TEST_TMP.before/.impeccable/scripts/package.json"
}

@test "malformed included workspace manifest fails before VERSION or root manifest changes" {
    prepare_release_layout
    mkdir -p "$TEST_TMP/apps/broken"
    printf '{ malformed included manifest\n' > "$TEST_TMP/apps/broken/package.json"
    cp "$TEST_TMP/package.json" "$TEST_TMP/root-package-before.json"

    cd "$TEST_TMP"
    run ./scripts/release/version-propagation.sh "0.2.0"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Invalid workspace package manifest: ./apps/broken/package.json"* ]]
    [ "$(cat "$TEST_TMP/VERSION")" = "0.1.0" ]
    cmp -s "$TEST_TMP/package.json" "$TEST_TMP/root-package-before.json"
}
@test "version-propagation: identity verification is mandatory and cannot be bypassed" {
    prepare_release_layout
    mkdir -p "$TEST_TMP/apps/web"
    printf '{"name":"web","version":"0.1.0"}\n' > "$TEST_TMP/apps/web/package.json"

    cd "$TEST_TMP"

    # A failing app-identity verifier aborts the write even without any bypass flag.
    cat > "$TEST_TMP/scripts/check-app-identity.mjs" <<'NODE'
console.error("identity drift");
process.exit(1);
NODE
    run ./scripts/release/version-propagation.sh "0.2.0"
    [ "$status" -eq 1 ]
    [[ "$output" == *"App identity verification failed after version propagation"* ]]
    # Verification runs after the write; the mandatory gate still surfaces the failure.
    [ "$(cat "$TEST_TMP/VERSION")" = "0.2.0" ]

    # The old bypass flag is gone: it is rejected as an unexpected argument.
    run ./scripts/release/version-propagation.sh "0.2.0" --no-verify
    [ "$status" -eq 1 ]
    [[ "$output" == *"Unexpected argument: --no-verify"* ]]
}
