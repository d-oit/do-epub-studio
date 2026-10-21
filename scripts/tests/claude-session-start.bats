#!/usr/bin/env bats
# BATS tests for scripts/hooks/claude-session-start.sh (GOAP-276 Phase 2).
#
# Covers the properties the SessionStart hook depends on: the output is
# valid JSON that Claude Code can use as session context, the docs index and
# the top changelog section are both present, the result is bounded, the
# truncation is explicit, the changelog section selection is deterministic,
# and the hook never emits anything from the environment or the network.

setup() {
    SCRIPT="$BATS_TEST_DIRNAME/../hooks/claude-session-start.sh"
    REPO_ROOT="$BATS_TEST_DIRNAME/../.."
    WORKDIR="$BATS_TEST_TMPDIR/repo"
    mkdir -p "$WORKDIR/scripts/hooks"
    cp "$SCRIPT" "$WORKDIR/scripts/hooks/claude-session-start.sh"
    chmod +x "$WORKDIR/scripts/hooks/claude-session-start.sh"
}

# Run the hook inside the isolated workdir and print its stdout.
run_hook() {
    (cd "$WORKDIR" && ./scripts/hooks/claude-session-start.sh </dev/null)
}

# Print the additionalContext string of the hook's JSON output.
context_of() {
    printf '%s' "$1" | node -e '
let raw = "";
process.stdin.on("data", (d) => { raw += d; });
process.stdin.on("end", () => {
    process.stdout.write(JSON.parse(raw).hookSpecificOutput.additionalContext);
});
'
}

@test "session-start hook: emits a single valid SessionStart JSON object" {
    printf '# Index\n\nsome docs\n' > "$WORKDIR/llms.txt"
    printf '# Changelog\n\n## [Unreleased]\n\n- a change\n' > "$WORKDIR/CHANGELOG.md"

    run run_hook
    [ "$status" -eq 0 ]
    printf '%s' "$output" | node -e '
let raw = "";
process.stdin.on("data", (d) => { raw += d; });
process.stdin.on("end", () => {
    const parsed = JSON.parse(raw);
    if (parsed.hookSpecificOutput.hookEventName !== "SessionStart") {
        throw new Error("hookEventName must be SessionStart");
    }
    if (typeof parsed.hookSpecificOutput.additionalContext !== "string") {
        throw new Error("additionalContext must be a string");
    }
});
'
}

@test "session-start hook: injects the llms.txt index" {
    printf '# Index\n\nMARKER_INDEX_LINE\n' > "$WORKDIR/llms.txt"
    printf '# Changelog\n\n## [Unreleased]\n\n- a change\n' > "$WORKDIR/CHANGELOG.md"

    run run_hook
    [ "$status" -eq 0 ]
    [[ "$(context_of "$output")" == *"MARKER_INDEX_LINE"* ]]
}

@test "session-start hook: injects only the top changelog section" {
    printf '# Index\n\nindex\n' > "$WORKDIR/llms.txt"
    printf '# Changelog\n\n## [Unreleased]\n\nMARKER_UNRELEASED\n\n## [0.1.0] - 2026-05-17\n\nMARKER_OLD_RELEASE\n' > "$WORKDIR/CHANGELOG.md"

    run run_hook
    [ "$status" -eq 0 ]
    local context
    context="$(context_of "$output")"
    [[ "$context" == *"MARKER_UNRELEASED"* ]]
    [[ "$context" != *"MARKER_OLD_RELEASE"* ]]
}

@test "session-start hook: keeps the complete index when it fits the budget" {
    printf '# Index\n\n' > "$WORKDIR/llms.txt"
    awk 'BEGIN { for (i = 1; i <= 50; i++) printf "index line %03d\n", i }' >> "$WORKDIR/llms.txt"
    printf '# Changelog\n\n## [Unreleased]\n\n- a change\n' > "$WORKDIR/CHANGELOG.md"

    run run_hook
    [ "$status" -eq 0 ]
    local context
    context="$(context_of "$output")"
    [[ "$context" == *"index line 050"* ]]
    [[ "$context" != *"[truncated:"* ]]
}

@test "session-start hook: truncates an oversized index with an explicit marker" {
    printf '# Index\n\n' > "$WORKDIR/llms.txt"
    awk 'BEGIN { for (i = 1; i <= 500; i++) printf "index line %03d %s\n", i, "padding padding padding padding padding" }' >> "$WORKDIR/llms.txt"
    printf '# Changelog\n\n## [Unreleased]\n\n- a change\n' > "$WORKDIR/CHANGELOG.md"

    run run_hook
    [ "$status" -eq 0 ]
    local context
    context="$(context_of "$output")"
    [[ "$context" == *"[truncated: llms.txt is"* ]]
    [[ "$context" == *"read llms.txt for the full index"* ]]
}

@test "session-start hook: truncates an oversized changelog section with an explicit marker" {
    printf '# Index\n\nindex\n' > "$WORKDIR/llms.txt"
    printf '# Changelog\n\n## [Unreleased]\n\n' > "$WORKDIR/CHANGELOG.md"
    awk 'BEGIN { for (i = 1; i <= 500; i++) printf "- changelog entry %03d %s\n", i, "padding padding padding padding padding" }' >> "$WORKDIR/CHANGELOG.md"

    run run_hook
    [ "$status" -eq 0 ]
    local context
    context="$(context_of "$output")"
    [[ "$context" == *"[truncated: the top CHANGELOG.md section is"* ]]
    [[ "$context" == *"read CHANGELOG.md for the full section"* ]]
}

@test "session-start hook: the injected context stays under the 10000 character limit" {
    printf '# Index\n\n' > "$WORKDIR/llms.txt"
    awk 'BEGIN { for (i = 1; i <= 500; i++) printf "index line %03d %s\n", i, "padding padding padding padding padding" }' >> "$WORKDIR/llms.txt"
    printf '# Changelog\n\n## [Unreleased]\n\n' > "$WORKDIR/CHANGELOG.md"
    awk 'BEGIN { for (i = 1; i <= 500; i++) printf "- changelog entry %03d %s\n", i, "padding padding padding padding padding" }' >> "$WORKDIR/CHANGELOG.md"

    run run_hook
    [ "$status" -eq 0 ]
    local length
    length="$(printf '%s' "$output" | node -e '
let raw = "";
process.stdin.on("data", (d) => { raw += d; });
process.stdin.on("end", () => {
    process.stdout.write(String(JSON.parse(raw).hookSpecificOutput.additionalContext.length));
});
')"
    [ "$length" -lt 10000 ]
}

@test "session-start hook: reports missing documentation files instead of failing" {
    run run_hook
    [ "$status" -eq 0 ]
    local context
    context="$(context_of "$output")"
    [[ "$context" == *"llms.txt"* ]]
    [[ "$context" == *"CHANGELOG.md"* ]]
    [[ "$context" == *"was not found in the repository root"* ]]
}

@test "session-start hook: output is deterministic across runs" {
    printf '# Index\n\ndeterministic content\n' > "$WORKDIR/llms.txt"
    printf '# Changelog\n\n## [Unreleased]\n\n- a change\n' > "$WORKDIR/CHANGELOG.md"

    run run_hook
    [ "$status" -eq 0 ]
    local first="$output"
    run run_hook
    [ "$status" -eq 0 ]
    [ "$first" = "$output" ]
}

@test "session-start hook: does not leak environment secrets into the context" {
    printf '# Index\n\nindex\n' > "$WORKDIR/llms.txt"
    printf '# Changelog\n\n## [Unreleased]\n\n- a change\n' > "$WORKDIR/CHANGELOG.md"

    run env SECRET_TOKEN="super-secret-value" bash -c 'cd "$1" && ./scripts/hooks/claude-session-start.sh </dev/null' _ "$WORKDIR"
    [ "$status" -eq 0 ]
    [[ "$output" != *"super-secret-value"* ]]
}

@test "session-start hook: the real repository files produce the docs index and changelog context" {
    run bash "$REPO_ROOT/scripts/hooks/claude-session-start.sh" </dev/null
    [ "$status" -eq 0 ]
    local context
    context="$(context_of "$output")"
    [[ "$context" == *"Repository documentation index (llms.txt):"* ]]
    [[ "$context" == *"Latest changelog section (CHANGELOG.md):"* ]]
}
