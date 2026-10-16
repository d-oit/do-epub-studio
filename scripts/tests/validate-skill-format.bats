#!/usr/bin/env bats
# BATS tests for scripts/validate-skill-format.sh required-section enforcement.
# Uses SKILLS_SRC fixtures; the final case validates the real repository skills.

setup() {
    SCRIPT="$BATS_TEST_DIRNAME/../validate-skill-format.sh"
    FIXTURES="$BATS_TEST_TMPDIR/skills"
    mkdir -p "$FIXTURES"
}

write_skill() { # <dir-name> <body-after-frontmatter>
    local name="$1" body="$2"
    mkdir -p "$FIXTURES/$name"
    printf -- '---\nversion: "1.0.0"\nname: %s\ndescription: Test fixture skill.\ncategory: quality\nallowed-tools: Read\nlicense: MIT\n---\n\n# %s\n\n%s\n' \
        "$name" "$name" "$body" > "$FIXTURES/$name/SKILL.md"
}

REQUIRED_TAIL=$'## Rationalizations\n\n| Rationalization | Reality |\n|-----------------|---------|\n| "excuse one" | rule one |\n| "excuse two" | rule two |\n\n## Red Flags\n\n- [ ] flag one\n- [ ] flag two\n- [ ] flag three'

@test "valid skill with both required sections passes" {
    write_skill good "$REQUIRED_TAIL"
    export SKILLS_SRC="$FIXTURES"
    run "$SCRIPT"
    [ "$status" -eq 0 ]
    [[ "$output" == *"good: Valid"* ]]
}

@test "missing Rationalizations section fails" {
    write_skill no-rat $'## Red Flags\n\n- [ ] flag one\n- [ ] flag two\n- [ ] flag three'
    export SKILLS_SRC="$FIXTURES"
    run "$SCRIPT"
    [ "$status" -eq 1 ]
    [[ "$output" == *'Missing "## Rationalizations" section'* ]]
}

@test "missing Red Flags section fails" {
    write_skill no-rf $'## Rationalizations\n\n| Rationalization | Reality |\n|-----------------|---------|\n| "excuse one" | rule one |\n| "excuse two" | rule two |'
    export SKILLS_SRC="$FIXTURES"
    run "$SCRIPT"
    [ "$status" -eq 1 ]
    [[ "$output" == *'Missing "## Red Flags" section'* ]]
}

@test "Rationalizations with a single data row fails" {
    write_skill one-row $'## Rationalizations\n\n| Rationalization | Reality |\n|-----------------|---------|\n| "only excuse" | only rule |\n\n## Red Flags\n\n- [ ] flag one\n- [ ] flag two\n- [ ] flag three'
    export SKILLS_SRC="$FIXTURES"
    run "$SCRIPT"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Rationalizations needs >=2 data rows (found 1)"* ]]
}

@test "Red Flags with fewer than three items fails" {
    write_skill two-flags $'## Rationalizations\n\n| Rationalization | Reality |\n|-----------------|---------|\n| "excuse one" | rule one |\n| "excuse two" | rule two |\n\n## Red Flags\n\n- [ ] flag one\n- [ ] flag two'
    export SKILLS_SRC="$FIXTURES"
    run "$SCRIPT"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Red Flags needs >=3 checklist items (found 2)"* ]]
}

@test "all repository skills pass" {
    unset SKILLS_SRC
    run "$SCRIPT"
    [ "$status" -eq 0 ]
}
