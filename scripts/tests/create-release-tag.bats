#!/usr/bin/env bats
# BATS tests for scripts/release/create-release-tag.sh
# Proves release identity/version verification gates cannot be skipped:
# a failed harness identity check, release signal, or workspace version drift
# must abort before any git tag/push occurs.

setup() {
    SCRIPT="$BATS_TEST_DIRNAME/../release/create-release-tag.sh"
    TEST_TMP="${BATS_TEST_TMPDIR:-${TMPDIR:-/tmp}}/release-tag-test-$$"
    mkdir -p "$TEST_TMP"
    GIT_STUB_LOG="$TEST_TMP/git-stub.log"
    : > "$GIT_STUB_LOG"
}

teardown() {
    rm -rf "$TEST_TMP"
}

prepare_tag_layout() {
    mkdir -p "$TEST_TMP/scripts/lib" "$TEST_TMP/scripts/release" "$TEST_TMP/bin"
    cp "$BATS_TEST_DIRNAME/../lib/colors.sh" "$TEST_TMP/scripts/lib/"
    cp "$BATS_TEST_DIRNAME/../lib/workspace-manifests.mjs" "$TEST_TMP/scripts/lib/"
    cp "$SCRIPT" "$TEST_TMP/scripts/release/create-release-tag.sh"
    chmod +x "$TEST_TMP/scripts/release/create-release-tag.sh"
    printf '0.1.0\n' > "$TEST_TMP/VERSION"
    cat > "$TEST_TMP/package.json" <<'JSON'
{"name":"root","version":"0.1.0"}
JSON
    cat > "$TEST_TMP/scripts/release/check-release-notes.sh" <<'SH'
#!/usr/bin/env bash
exit 0
SH
    chmod +x "$TEST_TMP/scripts/release/check-release-notes.sh"
    cat > "$TEST_TMP/scripts/check-harness-version.mjs" <<'NODE'
process.exit(0);
NODE
    cat > "$TEST_TMP/scripts/quality_gate.sh" <<'SH'
#!/usr/bin/env bash
exit 0
SH
    chmod +x "$TEST_TMP/scripts/quality_gate.sh"
    cat > "$TEST_TMP/bin/do-harness" <<'SH'
#!/usr/bin/env bash
case "$*" in
  "verify --set release --strict --record")
    [[ "${DO_HARNESS_AUTO_REPORT:-}" == "off" ]] || exit 71
    [[ "${HARNESS_RELEASE_FAIL:-0}" != "1" ]] || exit 1
    ;;
  "status --set release --format json")
    [[ "${DO_HARNESS_AUTO_REPORT:-}" == "off" ]] || exit 72
    if [[ "${HARNESS_RELEASE_STALE:-0}" == "1" ]]; then
      printf '%s\n' '{"state":"red","reason":"outdated"}'
    else
      printf '%s\n' '{"state":"green","reason":"current"}'
    fi
    ;;
  *) exit 70 ;;
esac
SH
    chmod +x "$TEST_TMP/bin/do-harness"
    cat > "$TEST_TMP/bin/git" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${GIT_STUB_LOG:-/dev/null}"
case "${1:-}" in
  rev-parse) echo main ;;
  diff|pull) exit 0 ;;
esac
exit 0
SH
    chmod +x "$TEST_TMP/bin/git"
    export GIT_STUB_LOG
    export PATH="$TEST_TMP/bin:$PATH"
}

@test "create-release-tag blocks when harness identity verification fails" {
    prepare_tag_layout
    cat > "$TEST_TMP/scripts/check-harness-version.mjs" <<'NODE'
console.error("do-harness version unavailable");
process.exit(1);
NODE
    cd "$TEST_TMP"
    run ./scripts/release/create-release-tag.sh
    [ "$status" -eq 1 ]
    if grep -qE "^(tag|push)" "$GIT_STUB_LOG"; then
        fail "tag/push attempted despite failing harness identity"
    fi
}

@test "create-release-tag reaches tag push only with current green release evidence" {
    prepare_tag_layout
    cd "$TEST_TMP"

    run ./scripts/release/create-release-tag.sh

    [ "$status" -eq 0 ]
    grep -qE '^tag -a v0\.1\.0' "$GIT_STUB_LOG"
    grep -qE '^push origin v0\.1\.0$' "$GIT_STUB_LOG"
}

@test "create-release-tag blocks when release signal verification fails" {
    prepare_tag_layout
    cd "$TEST_TMP"

    run env HARNESS_RELEASE_FAIL=1 ./scripts/release/create-release-tag.sh

    [ "$status" -eq 1 ]
    if grep -qE '^(tag|push)' "$GIT_STUB_LOG"; then
        fail "tag/push attempted despite failed release verification"
    fi
}

@test "create-release-tag blocks stale release evidence before tagging" {
    prepare_tag_layout
    cd "$TEST_TMP"

    run env HARNESS_RELEASE_STALE=1 ./scripts/release/create-release-tag.sh

    [ "$status" -eq 1 ]
    if grep -qE '^(tag|push)' "$GIT_STUB_LOG"; then
        fail "tag/push attempted with stale release evidence"
    fi
}

@test "create-release-tag blocks on workspace version drift and directs to version propagation" {
    prepare_tag_layout
    mkdir -p "$TEST_TMP/apps/web"
    printf '{"name":"web","version":"0.9.9"}\n' > "$TEST_TMP/apps/web/package.json"
    cd "$TEST_TMP"
    run ./scripts/release/create-release-tag.sh
    [ "$status" -eq 1 ]
    if grep -qE "^(tag|push)" "$GIT_STUB_LOG"; then
        fail "tag/push attempted despite workspace version drift"
    fi
}
