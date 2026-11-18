#!/usr/bin/env bats
# Exercise generated-catalog freshness without touching the repository output.

setup() {
    GENERATOR="$BATS_TEST_DIRNAME/../generate-available-skills.py"
    FIXTURE="$BATS_TEST_TMPDIR/catalog-repo"
    mkdir -p "$FIXTURE/.agents/skills/example"
    cat > "$FIXTURE/.agents/skills/example/SKILL.md" <<'SKILL'
---
name: example
description: "Example catalog entry with | separator."
category: testing
---
# Example
SKILL
}

run_generator() {
    (cd "$FIXTURE" && python3 "$GENERATOR" "$@")
}

@test "check reports a missing catalog and does not create output" {
    run run_generator --check

    [ "$status" -eq 1 ]
    [[ "$output" == *"Regenerate with"* ]]
    [[ "$output" == *"python3 scripts/generate-available-skills.py"* ]]
    [ ! -e "$FIXTURE/agents-docs" ]
}

@test "check reports stale bytes without modifying the catalog" {
    mkdir -p "$FIXTURE/agents-docs"
    printf 'stale catalog\n' > "$FIXTURE/agents-docs/AVAILABLE_SKILLS.md"
    cp "$FIXTURE/agents-docs/AVAILABLE_SKILLS.md" "$FIXTURE/original.md"

    run run_generator --check

    [ "$status" -eq 1 ]
    [[ "$output" == *"Regenerate with"* ]]
    run cmp -s "$FIXTURE/agents-docs/AVAILABLE_SKILLS.md" "$FIXTURE/original.md"
    [ "$status" -eq 0 ]
}

@test "generated canonical bytes pass check mode" {
    run run_generator
    [ "$status" -eq 0 ]

    run run_generator --check
    [ "$status" -eq 0 ]
    grep -Eq '^\| Skill +\| Description +\|$' "$FIXTURE/agents-docs/AVAILABLE_SKILLS.md"
    grep -Fq 'Example catalog entry with \| separator.' "$FIXTURE/agents-docs/AVAILABLE_SKILLS.md"
}
