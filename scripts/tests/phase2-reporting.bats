#!/usr/bin/env bats
# BATS tests for the GOAP-276 Phase 2 reporting scripts:
#   scripts/check-llms-drift.sh        — LLM context path/command drift
#   scripts/generate-compliance-doc.sh — compliance document generation + drift
#   scripts/report-dora.sh             — report-only DORA metrics
#
# The first two run against temporary fixtures so a drift case is provable
# without touching the repository. The DORA cases run against the real
# repository, which is where the policy and the git history live.

setup() {
    REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
    LLMS_DRIFT="$REPO_ROOT/scripts/check-llms-drift.sh"
    COMPLIANCE="$REPO_ROOT/scripts/generate-compliance-doc.sh"
    DORA_REPORT="$REPO_ROOT/scripts/report-dora.sh"
    VERSION_CHECK="$REPO_ROOT/scripts/check-harness-version.mjs"
    NODE_BIN="$(command -v node)"
}

make_harness_checker_fixture() {
    FIXTURE="$BATS_TEST_TMPDIR/$1"
    mkdir -p "$FIXTURE/bin"
    printf 'v0.4.6\n' > "$FIXTURE/.do-harness-version"
    cat > "$FIXTURE/bin/do-harness" <<'STUB'
#!/bin/sh
[ "$#" -eq 3 ] && [ "$1" = "version" ] && [ "$2" = "--format" ] && [ "$3" = "json" ] || exit 30
[ "${DO_HARNESS_AUTO_REPORT:-}" = "off" ] || exit 31
printf '%s\n' "${HARNESS_JSON:-}"
STUB
    chmod +x "$FIXTURE/bin/do-harness"
    cd "$FIXTURE"
}

# --- llms drift -------------------------------------------------------------

@test "llms drift check passes on the real repository" {
    run "$LLMS_DRIFT"
    [ "$status" -eq 0 ]
    [[ "$output" == *"No llms context drift"* ]]
}

@test "llms drift check reports a referenced path that no longer exists" {
    # A fixture repository whose llms.txt names a path that was removed.
    FIXTURE="$BATS_TEST_TMPDIR/fixture"
    mkdir -p "$FIXTURE/scripts" "$FIXTURE/apps/web"
    cp "$LLMS_DRIFT" "$FIXTURE/scripts/check-llms-drift.sh"
    printf '# fixture\n\n- `apps/web/removed-module/` — gone\n' > "$FIXTURE/llms.txt"
    printf '# fixture full\n' > "$FIXTURE/llms-full.txt"
    printf '{"scripts":{"lint":"echo lint","typecheck":"echo tsc"}}' > "$FIXTURE/package.json"
    printf 'x\n' > "$FIXTURE/CHANGELOG.md"
    mkdir -p "$FIXTURE/scripts/hooks"
    printf '#!/bin/sh\n' > "$FIXTURE/scripts/hooks/claude-session-start.sh"

    run bash "$FIXTURE/scripts/check-llms-drift.sh"
    [ "$status" -eq 1 ]
    [[ "$output" == *"MISSING path: apps/web/removed-module/"* ]]
}

@test "llms drift check reports a documented command that no longer exists" {
    FIXTURE="$BATS_TEST_TMPDIR/fixture-cmd"
    mkdir -p "$FIXTURE/scripts" "$FIXTURE/apps/web"
    cp "$LLMS_DRIFT" "$FIXTURE/scripts/check-llms-drift.sh"
    printf '# fixture\n\n```bash\npnpm definitely-not-a-script\n```\n' > "$FIXTURE/llms.txt"
    printf '# fixture full\n' > "$FIXTURE/llms-full.txt"
    printf '{"scripts":{"lint":"echo lint"}}' > "$FIXTURE/package.json"
    printf 'x\n' > "$FIXTURE/CHANGELOG.md"
    mkdir -p "$FIXTURE/scripts/hooks"
    printf '#!/bin/sh\n' > "$FIXTURE/scripts/hooks/claude-session-start.sh"

    run bash "$FIXTURE/scripts/check-llms-drift.sh"
    [ "$status" -eq 1 ]
    [[ "$output" == *"MISSING pnpm script: pnpm definitely-not-a-script"* ]]
}

# --- compliance document ----------------------------------------------------

@test "harness version checker accepts a matching identity and disables auto-reporting" {
    make_harness_checker_fixture "harness-match"

    run env PATH="$FIXTURE/bin:$PATH" DO_HARNESS_AUTO_REPORT=on \
        HARNESS_JSON='{"name":"do-harness","version":"0.4.6"}' "$NODE_BIN" "$VERSION_CHECK"
    [ "$status" -eq 0 ]
}

@test "harness version checker rejects a mismatched identity" {
    make_harness_checker_fixture "harness-mismatch"

    run env PATH="$FIXTURE/bin:$PATH" HARNESS_JSON='{"name":"do-harness","version":"0.4.5"}' \
        "$NODE_BIN" "$VERSION_CHECK"
    [ "$status" -eq 1 ]
}

@test "harness checker rejects a different executable identity at the pinned version" {
    make_harness_checker_fixture "harness-wrong-name"

    run env PATH="$FIXTURE/bin:$PATH" HARNESS_JSON='{"name":"other-tool","version":"0.4.6"}' \
        "$NODE_BIN" "$VERSION_CHECK"
    [ "$status" -eq 1 ]
}

@test "harness checker requires a v-prefixed stable version pin" {
    make_harness_checker_fixture "harness-invalid-pin"

    printf '0.4.6\n' > "$FIXTURE/.do-harness-version"
    run env PATH="$FIXTURE/bin:$PATH" HARNESS_JSON='{"name":"do-harness","version":"0.4.6"}' \
        "$NODE_BIN" "$VERSION_CHECK"
    [ "$status" -eq 1 ]

    printf 'v0.4.6-beta\n' > "$FIXTURE/.do-harness-version"
    run env PATH="$FIXTURE/bin:$PATH" HARNESS_JSON='{"name":"do-harness","version":"0.4.6"}' \
        "$NODE_BIN" "$VERSION_CHECK"
    [ "$status" -eq 1 ]
}

@test "harness version checker rejects invalid JSON" {
    make_harness_checker_fixture "harness-invalid-json"

    run env PATH="$FIXTURE/bin:$PATH" HARNESS_JSON='not-json' \
        "$NODE_BIN" "$VERSION_CHECK"
    [ "$status" -eq 1 ]
}

@test "harness version checker rejects a missing executable" {
    FIXTURE="$BATS_TEST_TMPDIR/harness-missing"
    mkdir -p "$FIXTURE/bin"
    printf 'v0.4.6\n' > "$FIXTURE/.do-harness-version"
    cd "$FIXTURE"

    run env PATH="$FIXTURE/bin" "$NODE_BIN" "$VERSION_CHECK"
    [ "$status" -eq 1 ]
}


@test "compliance document is up to date with the harness output" {
    run "$COMPLIANCE" --check
    [ "$status" -eq 0 ]
    [[ "$output" == *"up to date"* ]]
}

@test "compliance check rejects a mismatched harness without changing the document" {
    FIXTURE="$BATS_TEST_TMPDIR/harness-version-mismatch"
    mkdir -p "$FIXTURE/bin"
    cat > "$FIXTURE/bin/do-harness" <<'STUB'
#!/bin/sh
if [ "$1" = "version" ]; then
    printf '%s\n' '{"name":"do-harness","version":"0.4.5"}'
    exit 0
fi
exit 70
STUB
    chmod +x "$FIXTURE/bin/do-harness"
    cp "$REPO_ROOT/docs/compliance-mapping.md" "$FIXTURE/original.md"

    run env PATH="$FIXTURE/bin:$PATH" "$COMPLIANCE" --check

    [ "$status" -eq 1 ]
    cmp -s "$REPO_ROOT/docs/compliance-mapping.md" "$FIXTURE/original.md"
}

@test "compliance check rejects failed harness output instead of accepting partial output" {
    FIXTURE="$BATS_TEST_TMPDIR/harness-command-failure"
    mkdir -p "$FIXTURE/bin"
    cat > "$FIXTURE/bin/do-harness" <<'STUB'
#!/bin/sh
case "$1" in
    version) printf '%s\n' '{"name":"do-harness","version":"0.4.6"}' ;;
    compliance) printf '%s\n' 'partial output'; exit 9 ;;
    *) exit 70 ;;
esac
STUB
    chmod +x "$FIXTURE/bin/do-harness"
    cp "$REPO_ROOT/docs/compliance-mapping.md" "$FIXTURE/original.md"

    run env PATH="$FIXTURE/bin:$PATH" "$COMPLIANCE" --check

    [ "$status" -eq 1 ]
    cmp -s "$REPO_ROOT/docs/compliance-mapping.md" "$FIXTURE/original.md"
}


@test "compliance document passes markdownlint" {
    # The harness emits table rows with fewer cells than their header
    # declares, which markdownlint's MD056 rejects. The generator pads those
    # rows; without it the committed document fails the format hook.
    if command -v markdownlint >/dev/null 2>&1; then
        run markdownlint --config "$REPO_ROOT/.markdownlint.json" \
            "$REPO_ROOT/docs/compliance-mapping.md"
        [ "$status" -eq 0 ]
    else
        skip "markdownlint is not installed"
    fi
}

@test "compliance document tables have consistent header and row cell counts" {
    # Each table's header, separator, and data rows must use the same schema.
    run awk '
        BEGIN { FS = "|"; columns = 0; header_columns = 0; bad = 0 }
        !/^\|/ { columns = 0; header_columns = 0; next }
        /^\|/ {
            cells = NF - 2
            if ($0 ~ /^[|][[:space:]]*-+[[:space:]]*([|][[:space:]]*-+[[:space:]]*)+[|]$/) {
                if (header_columns != cells) bad = 1
                columns = cells
                next
            }
            if (columns == 0) {
                header_columns = cells
                next
            }
            if (cells != columns) bad = 1
        }
        END { exit bad }
    ' "$REPO_ROOT/docs/compliance-mapping.md"
    [ "$status" -eq 0 ]
}

# --- DORA report ------------------------------------------------------------

@test "dora threshold breach warns without blocking unless required" {
    FIXTURE="$BATS_TEST_TMPDIR/dora-report"
    mkdir -p "$FIXTURE/scripts" "$FIXTURE/plans" "$FIXTURE/bin"
    cp "$DORA_REPORT" "$FIXTURE/scripts/report-dora.sh"
    printf '{"window_days":30}\n' > "$FIXTURE/plans/dora.json"
    cat > "$FIXTURE/bin/do-harness" <<'STUB'
#!/bin/sh
[ "$1" = "dora" ] || exit 70
printf '%s\n' 'Deploys: 0' 'FINDINGS: 1' 'error: 1 DORA threshold exceeded'
exit 1
STUB
    chmod +x "$FIXTURE/bin/do-harness"

    run env PATH="$FIXTURE/bin:/usr/bin:/bin" bash "$FIXTURE/scripts/report-dora.sh"
    [ "$status" -eq 0 ]
    [[ "$output" == *"FINDINGS: 1"* ]]
    [[ "$output" == *"trend signal only, not a merge condition"* ]]

    run env PATH="$FIXTURE/bin:/usr/bin:/bin" DORA_REQUIRED=1 bash "$FIXTURE/scripts/report-dora.sh"
    [ "$status" -eq 1 ]
    [[ "$output" == *"DORA_REQUIRED=1"* ]]
}


@test "dora report tolerates a missing do-harness binary" {
    # The report must degrade to a warning, never to a failure, when the
    # harness is not installed.
    FIXTURE="$BATS_TEST_TMPDIR/no-harness"
    mkdir -p "$FIXTURE/scripts" "$FIXTURE/plans"
    cp "$DORA_REPORT" "$FIXTURE/scripts/report-dora.sh"
    printf '{"window_days":30}\n' > "$FIXTURE/plans/dora.json"
    mkdir -p "$FIXTURE/bin"
    printf '#!/bin/sh\nexit 127\n' > "$FIXTURE/bin/false"

    # PATH without the harness binary, but with the coreutils the script needs.
    run env PATH="$FIXTURE/bin:/usr/bin:/bin" bash "$FIXTURE/scripts/report-dora.sh"
    [ "$status" -eq 0 ]
}
