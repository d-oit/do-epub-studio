#!/usr/bin/env bats
# BATS tests for scripts/atomic-commit/verify.sh — the CI-check polling phase.
#
# The contract that matters: only a REAL check failure (exit 1) may destroy work.
# A deadline reached while checks are pending, or a run that never sees any
# checks, is inconclusive (exit 2) and must leave the PR and branch untouched —
# treating those as failures closed healthy PRs and force-pushed their branches
# back (PRs #1158 and #1160 were lost that way).
#
# The GitHub API is the network edge, so `gh` is stubbed; everything else runs
# for real.

setup() {
    VERIFY="$BATS_TEST_DIRNAME/../atomic-commit/verify.sh"
    STUB_DIR="$BATS_TEST_TMPDIR/bin"
    mkdir -p "$STUB_DIR"

    # Fake gh: serves checks from $FAKE_CHECKS and a fixed PR URL.
    cat > "$STUB_DIR/gh" <<'STUB'
#!/usr/bin/env bash
case "$1 $2" in
    "pr checks") printf '%s\n' "${FAKE_CHECKS:-[]}" ;;
    "pr view")   printf '%s\n' "https://example.test/pull/1" ;;
    *)           printf '%s\n' "[]" ;;
esac
STUB
    chmod +x "$STUB_DIR/gh"

    export PATH="$STUB_DIR:$PATH"
}

@test "exit 0 when every check passes" {
    export FAKE_CHECKS='[{"name":"ci","state":"SUCCESS","bucket":"pass"},{"name":"lint","state":"SUCCESS","bucket":"pass"}]'
    run "$VERIFY" 1 1800
    [ "$status" -eq 0 ]
}

@test "exit 1 when a check failed" {
    export FAKE_CHECKS='[{"name":"ci","state":"FAILURE","bucket":"fail"},{"name":"lint","state":"SUCCESS","bucket":"pass"}]'
    run "$VERIFY" 1 1800
    [ "$status" -eq 1 ]
}

@test "exit 2 (inconclusive) when the deadline passes with checks still pending" {
    export FAKE_CHECKS='[{"name":"ci","state":"PENDING","bucket":"pending"}]'
    # A clock that jumps forward makes the deadline trip on the first poll
    # without waiting out a real 60s budget.
    cat > "$STUB_DIR/date" <<'STUB'
#!/usr/bin/env bash
counter="${FAKE_CLOCK_FILE:?FAKE_CLOCK_FILE required}"
n=$(cat "$counter" 2>/dev/null || echo 0)
n=$((n + 1))
printf '%s' "$n" > "$counter"
printf '%s\n' "$((1700000000 + n * 3600))"
STUB
    chmod +x "$STUB_DIR/date"
    export FAKE_CLOCK_FILE="$BATS_TEST_TMPDIR/clock"
    : > "$FAKE_CLOCK_FILE"

    run "$VERIFY" 1 60
    [ "$status" -eq 2 ]
    [[ "$output" == *"INCONCLUSIVE"* ]]
}

@test "exit 2 (inconclusive) when no checks ever appear" {
    export FAKE_CHECKS='[]'
    # Jump the clock 60s per call so the zero grace window trips on the first
    # poll. Stubbing sleep with a poll loop instead would spawn a bash process
    # per iteration and exhaust the fork budget on constrained runners.
    cat > "$STUB_DIR/date" <<'STUB'
#!/usr/bin/env bash
counter="${FAKE_CLOCK_FILE:?FAKE_CLOCK_FILE required}"
n=$(cat "$counter" 2>/dev/null || echo 0)
n=$((n + 1))
printf '%s' "$n" > "$counter"
printf '%s\n' "$((1700000000 + n * 60))"
STUB
    chmod +x "$STUB_DIR/date"
    export FAKE_CLOCK_FILE="$BATS_TEST_TMPDIR/clock-nochecks"
    : > "$FAKE_CLOCK_FILE"

    ATOMIC_COMMIT_NO_CHECKS_GRACE=0 run "$VERIFY" 1 1800
    [ "$status" -eq 2 ]
    [[ "$output" == *"INCONCLUSIVE"* ]]
}

@test "only a real failure maps to the destructive rollback" {
    # shellcheck source=scripts/lib/verify-outcome.sh
    source "$BATS_TEST_DIRNAME/../lib/verify-outcome.sh"

    [ "$(decide_verify_action 0)" = "passed" ]
    [ "$(decide_verify_action 1)" = "rollback" ]
    # Timeouts, unknown exit codes and a missing argument must never roll back.
    [ "$(decide_verify_action 2)" = "keep" ]
    [ "$(decide_verify_action 7)" = "keep" ]
    [ "$(decide_verify_action "")" = "keep" ]
}
