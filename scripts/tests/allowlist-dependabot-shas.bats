#!/usr/bin/env bats
# BATS tests for scripts/allowlist-dependabot-shas.sh (GOAP-270 / ADR-247).

setup() {
    SCRIPT="$BATS_TEST_DIRNAME/../allowlist-dependabot-shas.sh"
    # shellcheck disable=SC1090
    source "$SCRIPT"
    SANDBOX="$(mktemp -d)"
    ALLOWLIST="$SANDBOX/validate-shas.sh"
    cp "$BATS_TEST_DIRNAME/../validate-shas.sh" "$ALLOWLIST"
    # Stub upstream resolution so verification succeeds by default (the
    # resolved commit matches the SHAs used in the flow tests below).
    # Individual tests override this or verify_tag_commit to fail.
    resolve_tag_commit() { printf '%s\n' "${MOCK_RESOLVED_SHA:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"; }
}

teardown() {
    rm -rf "$SANDBOX"
}

write_diff() {
    cat > "$SANDBOX/pr.diff"
}

@test "parse extracts added uses lines from workflow files only" {
    write_diff <<'EOF'
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -3,3 +3,4 @@
   - uses: actions/setup-node@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb  # v4.0.0
-  - uses: actions/checkout@cccccccccccccccccccccccccccccccccccccccc  # v6.0.0
+  - uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  # v7.0.1
+  - uses: owner/repo/act@dddddddddddddddddddddddddddddddddddddddd
diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1,2 +1,3 @@
+  - uses: evil/action@eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee  # v1.0.0
EOF
    run parse_added_uses "$SANDBOX/pr.diff"
    [ "$status" -eq 0 ]
    [ "${#lines[@]}" -eq 2 ]
    [[ "${lines[0]}" == $'actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\tv7.0.1' ]]
    [[ "${lines[1]}" == $'owner/repo/act@dddddddddddddddddddddddddddddddddddddddd\t' ]]
}

@test "action_repo_slug reduces an action ref to owner/repo" {
    run action_repo_slug "github/codeql-action/init@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    [ "$status" -eq 0 ]
    [ "$output" = "github/codeql-action" ]
    run action_repo_slug "actions/checkout@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    [ "$output" = "actions/checkout" ]
}

@test "appends verified entries and the result allowlists them" {
    write_diff <<'EOF'
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,1 +1,2 @@
+  - uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  # v7.0.1
EOF
    run main --diff "$SANDBOX/pr.diff" --allowlist "$ALLOWLIST"
    [ "$status" -eq 0 ]
    grep -qF '"actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' "$ALLOWLIST"
    # The modified allowlist must accept the new entry via its own checker.
    (
        # shellcheck disable=SC1090
        source "$ALLOWLIST"
        is_allowed_sha "actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    )
}

@test "dry-run reports without modifying the allowlist" {
    write_diff <<'EOF'
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,1 +1,2 @@
+  - uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  # v7.0.1
EOF
    cp "$ALLOWLIST" "$SANDBOX/before"
    run main --diff "$SANDBOX/pr.diff" --allowlist "$ALLOWLIST" --dry-run
    [ "$status" -eq 0 ]
    cmp -s "$SANDBOX/before" "$ALLOWLIST"
}

@test "fails closed on an added pin with no version tag" {
    write_diff <<'EOF'
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,1 +1,2 @@
+  - uses: owner/repo/act@dddddddddddddddddddddddddddddddddddddddd
EOF
    cp "$ALLOWLIST" "$SANDBOX/before"
    run main --diff "$SANDBOX/pr.diff" --allowlist "$ALLOWLIST"
    [ "$status" -eq 1 ]
    cmp -s "$SANDBOX/before" "$ALLOWLIST"
}

@test "fails closed when upstream verification rejects the SHA" {
    write_diff <<'EOF'
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,1 +1,2 @@
+  - uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  # v7.0.1
EOF
    verify_tag_commit() { return 1; }
    cp "$ALLOWLIST" "$SANDBOX/before"
    run main --diff "$SANDBOX/pr.diff" --allowlist "$ALLOWLIST"
    [ "$status" -eq 1 ]
    cmp -s "$SANDBOX/before" "$ALLOWLIST"
}

@test "fails closed on a tag with glob metacharacters" {
    write_diff <<'EOF'
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,1 +1,2 @@
+  - uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  # v7.0.*
EOF
    cp "$ALLOWLIST" "$SANDBOX/before"
    run main --diff "$SANDBOX/pr.diff" --allowlist "$ALLOWLIST"
    [ "$status" -eq 1 ]
    cmp -s "$SANDBOX/before" "$ALLOWLIST"
}

@test "fails closed on a malformed action pin" {
    write_diff <<'EOF'
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,1 +1,2 @@
+  - uses: actions/checkout@not-a-sha  # v7.0.1
EOF
    cp "$ALLOWLIST" "$SANDBOX/before"
    run main --diff "$SANDBOX/pr.diff" --allowlist "$ALLOWLIST"
    [ "$status" -eq 1 ]
    cmp -s "$SANDBOX/before" "$ALLOWLIST"
}

@test "is idempotent: already allowlisted entries are skipped" {
    write_diff <<'EOF'
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,1 +1,2 @@
+  - uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  # v7.0.1
EOF
    run main --diff "$SANDBOX/pr.diff" --allowlist "$ALLOWLIST"
    [ "$status" -eq 0 ]
    cp "$ALLOWLIST" "$SANDBOX/after-first"
    run main --diff "$SANDBOX/pr.diff" --allowlist "$ALLOWLIST"
    [ "$status" -eq 0 ]
    cmp -s "$SANDBOX/after-first" "$ALLOWLIST"
    [ "$(grep -cF '"actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' "$ALLOWLIST")" -eq 1 ]
}

@test "no diff source is a usage error" {
    run main
    [ "$status" -eq 2 ]
}

@test "verify_tag_commit passes when resolution equals the expected commit" {
    resolve_tag_commit() { printf 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n'; }
    run verify_tag_commit "https://github.com/owner/repo.git" "v1.0.0" "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    [ "$status" -eq 0 ]
}

@test "verify_tag_commit fails when resolution differs from the expected commit" {
    resolve_tag_commit() { printf 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n'; }
    run verify_tag_commit "https://github.com/owner/repo.git" "v1.0.0" "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    [ "$status" -eq 1 ]
}

@test "verify_tag_commit fails when the tag resolves to nothing" {
    resolve_tag_commit() { return 1; }
    run verify_tag_commit "https://github.com/owner/repo.git" "v9.9.9" "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    [ "$status" -eq 1 ]
}
