#!/usr/bin/env bats
# BATS tests for roast-batch-close.sh — collect partitioning + dry-run/execute gating.
# Uses a stub `gh` on PATH: GH_STUB_MODE=emit cats a canned JSON fixture
# (GH_EMIT_FILE) for `gh pr list`; every non-auth invocation's args are
# appended to $GH_LOG_FILE so tests can assert exactly what gh was asked to do.

setup() {
    ORIG_TMPDIR="${TMPDIR:-}"
    TMPDIR="$(mktemp -d)"
    GH_LOG_FILE="$TMPDIR/gh.log"
    : > "$GH_LOG_FILE"
    export GH_LOG_FILE
    export GH_EMIT_FILE="$TMPDIR/prs.json"
    export GH_STUB_MODE="${GH_STUB_MODE:-record}"
    mkdir -p "$TMPDIR/bin"
    cat > "$TMPDIR/bin/gh" <<'STUB'
#!/usr/bin/env bash
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then exit 0; fi
printf '%s\n' "$*" >>"$GH_LOG_FILE"
if [ "$GH_STUB_MODE" = "emit" ] && [ "$1" = "pr" ] && [ "$2" = "list" ]; then
  cat "$GH_EMIT_FILE"
fi
if [ "$GH_STUB_MODE" = "emit" ] && [ "$1" = "pr" ] && [ "$2" = "view" ]; then
  jq -c --arg n "$3" '.[$n] // empty' "$GH_EMIT_FILE"
fi
exit 0
STUB
    chmod +x "$TMPDIR/bin/gh"
    export PATH="$TMPDIR/bin:$PATH"
    SCRIPT="$BATS_TEST_DIRNAME/../scripts/roast-batch-close.sh"
}

teardown() {
    rm -rf "$TMPDIR"
    if [ -n "$ORIG_TMPDIR" ]; then
        export TMPDIR="$ORIG_TMPDIR"
    fi
}

# mk_pr NUMBER TITLE AUTHOR CREATED_ISO IS_DRAFT LABELS_JSON
mk_pr() {
    printf '{"number":%s,"title":"%s","author":{"login":"%s"},"createdAt":"%s","updatedAt":"%s","additions":10,"deletions":2,"changedFiles":1,"baseRefName":"main","headRefName":"feat/x","isDraft":%s,"mergeable":"MERGEABLE","reviewDecision":"","labels":%s,"url":"https://github.test/d-oit/do-epub-studio/pull/%s"}' \
        "$1" "$2" "$3" "$4" "$4" "$5" "$6" "$1"
}

days_ago_iso() {
    date -u -d "$1 days ago" +%Y-%m-%dT%H:%M:%SZ
}

@test "collect emits dossier keys and partitions candidates vs excluded drafts" {
    local old
    old="$(days_ago_iso 45)"
    printf '[%s,%s,%s]' \
        "$(mk_pr 101 "Refactor reader core" alice "$old" false '[]')" \
        "$(mk_pr 102 "Add progress bar" bob "$old" false '[]')" \
        "$(mk_pr 103 "WIP notes" carol "$old" true '[]')" > "$GH_EMIT_FILE"

    GH_STUB_MODE=emit run "$SCRIPT" collect -R d-oit/do-epub-studio

    echo "$output" | jq -e 'keys | sort == ["candidates","excluded","exclusions","generated_at","repo"]' >/dev/null
    [ "$(echo "$output" | jq '.repo')" = '"d-oit/do-epub-studio"' ]
    [ "$(echo "$output" | jq '.candidates | length')" = "2" ]
    [ "$(echo "$output" | jq '.excluded | length')" = "1" ]
    [ "$(echo "$output" | jq -r '.excluded[0].reason')" = "draft" ]
    [ "$(echo "$output" | jq -r '.excluded[0].number')" = "103" ]
    [ "$(echo "$output" | jq -r '.candidates[0].author')" = "alice" ]
}

@test "collect --exclude-author moves that author's PRs to excluded" {
    local old
    old="$(days_ago_iso 45)"
    printf '[%s,%s]' \
        "$(mk_pr 201 "Owner PR" d-oit "$old" false '[]')" \
        "$(mk_pr 202 "Other PR" bob "$old" false '[]')" > "$GH_EMIT_FILE"

    GH_STUB_MODE=emit run "$SCRIPT" collect -R d-oit/do-epub-studio --exclude-author d-oit

    [ "$(echo "$output" | jq '.candidates | length')" = "1" ]
    [ "$(echo "$output" | jq -r '.excluded[0].reason')" = "author:d-oit" ]
    [ "$(echo "$output" | jq -r '.excluded[0].number')" = "201" ]
    [ "$(echo "$output" | jq '.exclusions.authors == ["d-oit"]')" = "true" ]
}

@test "collect includes brand-new PRs as candidates (no age gate)" {
    printf '[%s]' "$(mk_pr 301 "Fresh fix" alice "$(days_ago_iso 0)" false '[]')" > "$GH_EMIT_FILE"

    GH_STUB_MODE=emit run "$SCRIPT" collect -R d-oit/do-epub-studio

    [ "$(echo "$output" | jq '.candidates | length')" = "1" ]
    [ "$(echo "$output" | jq -r '.candidates[0].number')" = "301" ]
    [ "$(echo "$output" | jq '.excluded | length')" = "0" ]
}

@test "close without --execute prints command and never calls gh" {
    local comment="$TMPDIR/comment.md"
    printf 'Closing: no functional change.' > "$comment"

    run "$SCRIPT" close -R d-oit/do-epub-studio --pr 42 --comment-file "$comment"
    [ "$status" -eq 0 ]
    [ "$output" = "gh pr close 42 -R d-oit/do-epub-studio --comment \"\$(cat $comment)\"" ]

    # Dry-run safety: no gh invocation beyond the (unlogged) auth check.
    [ ! -s "$GH_LOG_FILE" ]
}

@test "close --execute invokes gh with close and comment file" {
    local comment="$TMPDIR/comment.md"
    printf 'Closing: no functional change.' > "$comment"

    run "$SCRIPT" close -R d-oit/do-epub-studio --pr 42 --comment-file "$comment" --execute
    [ "$status" -eq 0 ]

    run cat "$GH_LOG_FILE"
    [[ "$output" == "pr close 42 -R d-oit/do-epub-studio --comment Closing: no functional change." ]]
}

@test "review --decision request-changes --execute invokes gh with --request-changes" {
    local comment="$TMPDIR/review.md"
    printf 'Required changes listed in the roast report.' > "$comment"

    run "$SCRIPT" review -R d-oit/do-epub-studio --pr 77 --decision request-changes --comment-file "$comment" --execute
    [ "$status" -eq 0 ]

    run cat "$GH_LOG_FILE"
    [[ "$output" == "pr review 77 -R d-oit/do-epub-studio --request-changes --body-file $comment" ]]
}

mk_view() {
    local n="$1" created="$2" paths="$3"
    local files_json
    files_json="$(printf '[%s]' "$paths" | jq -c '[.[] | {"path": .}]')"
    printf '{"number":%s,"title":"t-%s","isDraft":false,"labels":[],"mergeable":"MERGEABLE","createdAt":"%s","headRefName":"feat/%s","files":%s}' \
        "$n" "$n" "$created" "$n" "$files_json"
}

@test "merge dry-run orders independent PR first and prints sync+merge steps" {
    printf '{"1001":%s,"1002":%s,"1003":%s}' \
        "$(mk_view 1001 "2026-08-01T00:00:00Z" '"a.ts","b.ts"')" \
        "$(mk_view 1002 "2026-08-02T00:00:00Z" '"c.ts"')" \
        "$(mk_view 1003 "2026-08-03T00:00:00Z" '"b.ts","d.ts"')" > "$GH_EMIT_FILE"

    GH_STUB_MODE=emit run "$SCRIPT" merge -R d-oit/do-epub-studio --pr 1001 --pr 1002 --pr 1003
    [ "$status" -eq 0 ]
    [[ "$output" == *"MERGE ORDER: 1002 -> 1001 -> 1003"* ]]
    [[ "$output" == *"gh pr checkout 1002"* ]]
    [[ "$output" == *"git merge --no-edit origin/main"* ]]
    [[ "$output" == *"gh pr merge 1003"* ]]
    ! grep -q "pr merge" "$GH_LOG_FILE"
}

@test "merge dry-run refuses draft and protected-label PRs" {
    printf '{"2001":{"number":2001,"title":"draft","isDraft":true,"labels":[],"mergeable":"MERGEABLE","createdAt":"2026-08-01T00:00:00Z","headRefName":"feat/2001","files":[{"path":"x.ts"}]},"2002":{"number":2002,"title":"sec","isDraft":false,"labels":[{"name":"security"}],"mergeable":"MERGEABLE","createdAt":"2026-08-01T00:00:00Z","headRefName":"feat/2002","files":[{"path":"y.ts"}]}}' > "$GH_EMIT_FILE"

    GH_STUB_MODE=emit run "$SCRIPT" merge -R d-oit/do-epub-studio --pr 2001 --pr 2002
    [ "$status" -eq 2 ]
    [[ "$output" == *"REFUSED pr 2001: draft"* ]]
    [[ "$output" == *"REFUSED pr 2002: label security"* ]]
}

@test "merge --execute --no-sync-main records checkout and merge in order" {
    repo="$TMPDIR/repo"
    mkdir -p "$repo" && git -C "$repo" init -q
    git -C "$repo" config user.email "t@t" && git -C "$repo" config user.name "t"
    git -C "$repo" commit --allow-empty -m "init" >/dev/null
    prev_branch="$(git -C "$repo" rev-parse --abbrev-ref HEAD)"
    printf '{"1001":%s,"1002":%s}' \
        "$(mk_view 1001 "2026-08-01T00:00:00Z" '"a.ts"')" \
        "$(mk_view 1002 "2026-08-02T00:00:00Z" '"b.ts"')" > "$GH_EMIT_FILE"

    GH_STUB_MODE=emit run bash -c "cd \"$repo\" && GH_EMIT_FILE=\"$GH_EMIT_FILE\" GH_LOG_FILE=\"$GH_LOG_FILE\" GH_STUB_MODE=emit PATH=\"$TMPDIR/bin:\$PATH\" \"$SCRIPT\" merge -R d-oit/do-epub-studio --pr 1001 --pr 1002 --execute --no-sync-main"
    [ "$status" -eq 0 ]
    grep -q "pr checkout 1001" "$GH_LOG_FILE"
    grep -q "pr merge 1001.*--squash" "$GH_LOG_FILE"
    grep -q "pr merge 1002.*--squash" "$GH_LOG_FILE"
}
