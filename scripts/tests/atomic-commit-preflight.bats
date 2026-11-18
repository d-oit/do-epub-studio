#!/usr/bin/env bats
# Exercise the real pre-commit validator with an isolated repository and stubs
# for Git, the quality gate, and GitHub authentication.

setup() {
    REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
    FIXTURE="$BATS_TEST_TMPDIR/repo"
    BIN="$FIXTURE/bin"
    VALIDATE="$FIXTURE/scripts/atomic-commit/validate.sh"
    GATE_MARKER="$BATS_TEST_TMPDIR/quality-gate-ran"

    mkdir -p "$BIN" "$FIXTURE/scripts/atomic-commit" "$FIXTURE/scripts/lib"
    cp "$REPO_ROOT/scripts/atomic-commit/validate.sh" "$VALIDATE"
    cp "$REPO_ROOT/scripts/lib/colors.sh" "$FIXTURE/scripts/lib/colors.sh"
    cp "$REPO_ROOT/scripts/lib/logging.sh" "$FIXTURE/scripts/lib/logging.sh"
    chmod +x "$VALIDATE"

    cat > "$BIN/git" <<'STUB'
#!/usr/bin/env bash
case "$*" in
    "branch --show-current") printf '%s\n' "feat/preflight-test" ;;
    "diff --cached --quiet") [[ "${STAGED_CHANGES:-0}" == 1 ]] && exit 1 || exit 0 ;;
    "diff --cached --name-only") [[ "${STAGED_CHANGES:-0}" == 1 ]] && printf '%s\n' "README.md" ;;
    "diff --cached -- README.md") ;;
    "diff --name-only") ;;
    "ls-files --others --exclude-standard") ;;
    *) printf 'Unexpected git invocation: %s\n' "$*" >&2; exit 2 ;;
esac
STUB
    cat > "$BIN/gh" <<'STUB'
#!/usr/bin/env bash
[[ "$*" == "auth status" ]]
STUB
    cat > "$FIXTURE/scripts/quality_gate.sh" <<'STUB'
#!/usr/bin/env bash
: > "$GATE_MARKER"
printf '%s\n' "Quality gate fixture passed"
STUB
    chmod +x "$BIN/git" "$BIN/gh" "$FIXTURE/scripts/quality_gate.sh"
    export PATH="$BIN:$PATH"
    export GATE_MARKER
}

@test "empty staged diff rejects preflight without running the quality gate" {
    export STAGED_CHANGES=0

    run "$VALIDATE"

    [ "$status" -eq 1 ]
    [[ "$output" == *"No staged changes to commit"* ]]
    [ ! -e "$GATE_MARKER" ]
}

@test "non-empty staged diff reaches the quality gate and completes preflight" {
    export STAGED_CHANGES=1

    run "$VALIDATE"

    [ "$status" -eq 0 ]
    [ -e "$GATE_MARKER" ]
    [[ "$output" == *"All Pre-Commit Validations PASSED"* ]]
}
