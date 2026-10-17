#!/usr/bin/env bats
# BATS tests for scripts/check-untrusted-ingest-sinks.mjs.
# Fixtures prove each sink is caught, and that non-executable mentions
# (prose, comments) and the real consumers stay clean.

setup() {
    SCRIPT="$BATS_TEST_DIRNAME/../check-untrusted-ingest-sinks.mjs"
    FIXTURES="$BATS_TEST_TMPDIR/consumers"
    mkdir -p "$FIXTURES"
}

@test "clean fixture passes (prose and comments may mention sinks)" {
    cat > "$FIXTURES/clean.md" <<'MD'
# Consumer

Never use eval on PR titles. Prefer:

```bash
gh pr view "$PR_NUMBER" --json number
```
MD
    cat > "$FIXTURES/clean.sh" <<'SH'
#!/usr/bin/env bash
# exec would replace the shell; eval is banned
set -euo pipefail
gh pr merge "$PR_NUMBER" --squash
SH
    run node "$SCRIPT" "$FIXTURES"
    [ "$status" -eq 0 ]
    [[ "$output" == *"clean"* ]]
}

@test "eval inside a shell fence fails" {
    cat > "$FIXTURES/eval.md" <<'MD'
# Consumer

```bash
eval "$(gh pr view "$PR_NUMBER" --json body --jq .body)"
```
MD
    run node "$SCRIPT" "$FIXTURES"
    [ "$status" -eq 1 ]
    [[ "$output" == *"[eval]"* ]]
}

@test "sh -c fails" {
    printf '#!/usr/bin/env bash\nsh -c "echo $PR_TITLE"\n' > "$FIXTURES/shell-c.sh"
    run node "$SCRIPT" "$FIXTURES"
    [ "$status" -eq 1 ]
    [[ "$output" == *"[shell -c]"* ]]
}

@test "exec fails" {
    printf '#!/usr/bin/env bash\nexec "$SELF" --continue\n' > "$FIXTURES/exec.sh"
    run node "$SCRIPT" "$FIXTURES"
    [ "$status" -eq 1 ]
    [[ "$output" == *"[exec]"* ]]
}

@test "shell-enabled spawn fails" {
    printf 'import { spawn } from "node:child_process";\nspawn("gh", ["pr", "view"], { shell: true });\n' > "$FIXTURES/spawn.mjs"
    run node "$SCRIPT" "$FIXTURES"
    [ "$status" -eq 1 ]
    [[ "$output" == *"[shell-enabled spawn]"* ]]
}

@test "Python subprocess with shell=True fails" {
    printf 'import subprocess\nsubprocess.run("gh pr view " + number, shell=True)\n' > "$FIXTURES/run.py"
    run node "$SCRIPT" "$FIXTURES"
    [ "$status" -eq 1 ]
    [[ "$output" == *"[shell-enabled spawn]"* ]]
}

@test "eval inside a workflow run block fails" {
    cat > "$FIXTURES/workflow.yml" <<'YML'
name: x
jobs:
  y:
    steps:
      - run: |
          eval "$PR_BODY"
YML
    run node "$SCRIPT" "$FIXTURES"
    [ "$status" -eq 1 ]
    [[ "$output" == *"[eval]"* ]]
}

@test "comment-only lines in a shell fence are ignored" {
    cat > "$FIXTURES/comment.md" <<'MD'
# Consumer

```bash
# eval is banned here
gh pr view "$PR_NUMBER" --json number
```
MD
    run node "$SCRIPT" "$FIXTURES"
    [ "$status" -eq 0 ]
}

@test "missing target fails instead of passing vacuously" {
    run node "$SCRIPT" "$FIXTURES/does-not-exist"
    [ "$status" -eq 1 ]
    [[ "$output" == *"target does not exist"* ]]
}

@test "all repository consumers are clean" {
    run node "$SCRIPT"
    [ "$status" -eq 0 ]
    [[ "$output" == *"0 findings"* ]]
}
