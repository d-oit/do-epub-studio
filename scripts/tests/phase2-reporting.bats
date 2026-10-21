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

@test "the installed do-harness matches the version CI pins" {
    # The compliance document and the DORA policy are artifacts of a SPECIFIC
    # harness version - the one `.github/workflows/ci.yml` installs for the
    # `harness-contract` job. A newer local binary changes the compliance
    # output and the dora policy schema, and the two checks below then fail
    # with what looks like content drift but is a version mismatch. Assert the
    # pin first so the failure names the real cause.
    if ! command -v do-harness >/dev/null 2>&1; then
        skip "do-harness is not installed"
    fi
    local pinned
    pinned="$(grep -oE 'DO_HARNESS_VERSION: v[0-9.]+' "$REPO_ROOT/.github/workflows/ci.yml" | head -1 | awk '{print $2}')"
    [ -n "$pinned" ]
    # `do-harness --version` prints the version without the leading "v".
    local expected="${pinned#v}"
    run do-harness --version
    [ "$status" -eq 0 ]
    [[ "$output" == *"$expected"* ]]
}

@test "compliance document exists and is the generated content" {
    [ -f "$REPO_ROOT/docs/compliance-mapping.md" ]
    run grep -c "do not edit by hand" "$REPO_ROOT/docs/compliance-mapping.md"
    [ "$status" -eq 0 ]
    [ "$output" -gt 0 ]
}

@test "compliance document is up to date with the harness output" {
    run "$COMPLIANCE" --check
    [ "$status" -eq 0 ]
    [[ "$output" == *"up to date"* ]]
}

@test "compliance document states it is not a certification" {
    run grep -c "not\*\* a certification" "$REPO_ROOT/docs/compliance-mapping.md"
    [ "$status" -eq 0 ]
    [ "$output" -gt 0 ]
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

@test "compliance document tables have a uniform cell count" {
    # The same invariant as the markdownlint case, checked without the tool:
    # every table row must carry as many cells as its header.
    run awk '
        BEGIN { FS = "|"; columns = 0; bad = 0 }
        /^\|/ {
            cells = NF - 2
            if ($0 ~ /^[|][[:space:]]*-+[[:space:]]*([|][[:space:]]*-+[[:space:]]*)+[|]$/) {
                columns = cells; next
            }
            if (columns > 0 && cells != columns) bad = 1
        }
        END { exit bad }
    ' "$REPO_ROOT/docs/compliance-mapping.md"
    [ "$status" -eq 0 ]
}

# --- DORA report ------------------------------------------------------------

@test "dora report is report-only and exits zero" {
    run "$DORA_REPORT"
    # Report-only: a metrics breach must never fail the run.
    [ "$status" -eq 0 ]
}

@test "dora report shows the measured metrics" {
    run "$DORA_REPORT"
    [ "$status" -eq 0 ]
    [[ "$output" == *"deploys"* ]]
    [[ "$output" == *"lead time"* ]]
}

@test "dora policy pins a ref pattern, not a bare glob" {
    # A bare glob silently matches nothing and the harness then reports zero
    # deploys forever; the ref pattern is what makes the metric real.
    run grep -c '"tag_glob": "refs/tags/' "$REPO_ROOT/plans/dora.json"
    [ "$status" -eq 0 ]
    [ "$output" -gt 0 ]
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
