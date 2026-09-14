#!/usr/bin/env bash
# Allowlist Dependabot-pinned action SHAs after upstream verification (ADR-247).
#
# Parses a unified PR diff for ADDED `uses: owner/repo@<40-hex-sha>` lines in
# .github/workflows, verifies each new SHA is what the action's own upstream
# repository claims (the trailing `# vX.Y.Z` tag must dereference to that
# commit via `git ls-remote <upstream> refs/tags/<tag>^{}`), and appends
# verified entries to the ALLOWED_SHAS list in scripts/validate-shas.sh.
#
# Fails closed per ADR-247: the allowlist is modified only when EVERY new SHA
# verifies; an unresolvable, ambiguous, or malformed entry exits non-zero with
# no modification. The script never merges and never trusts data from the PR
# body or comments — verification reads only from upstream git refs.
#
# Usage:
#   allowlist-dependabot-shas.sh --diff <file> [--allowlist <file>] [--dry-run]
#   allowlist-dependabot-shas.sh --pr <number> [--allowlist <file>] [--dry-run]

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

DEFAULT_ALLOWLIST="$REPO_ROOT/scripts/validate-shas.sh"

usage() {
    printf 'Usage: %s (--diff <file> | --pr <number>) [--allowlist <file>] [--dry-run]\n' \
        "$(basename "${BASH_SOURCE[0]}")"
}

err() {
    printf '%s✗ %s%s\n' "${RED}" "$1" "${NC}" >&2
}

ok() {
    printf '%s✓ %s%s\n' "${GREEN}" "$1" "${NC}"
}

# Print "action@sha<TAB>tag" for every uses: line ADDED in .github/workflows
# files. Lines removed or kept by the diff are ignored, as are uses: lines in
# files outside .github/workflows. The tag is empty when the line carries no
# `# <version>` comment; callers must fail closed on an empty tag.
parse_added_uses() {
    local diff_file="$1"
    awk '
        /^diff --git / { in_file = 0; next }
        /^\+\+\+ b\// {
            path = substr($0, 7)
            in_file = (path ~ /^\.github\/workflows\/.*\.ya?ml$/) ? 1 : 0
            next
        }
        in_file && /^\+/ {
            line = substr($0, 2)
            if (line !~ /^[[:space:]]*-?[[:space:]]*uses:/) { next }
            sub(/^[[:space:]]*-?[[:space:]]*uses:[[:space:]]*/, "", line)
            split_on = index(line, "#")
            if (split_on > 0) {
                tag = substr(line, split_on + 1)
                line = substr(line, 1, split_on - 1)
            } else {
                tag = ""
            }
            gsub(/[[:space:]]+$/, "", line)
            gsub(/^[[:space:]]+/, "", tag)
            gsub(/[[:space:]]+$/, "", tag)
            printf "%s\t%s\n", line, tag
        }
    ' "$diff_file"
}

# A valid action reference is owner/repo[/path]@<40 lowercase hex chars>.
is_valid_action_sha() {
    local action="$1"
    [[ "$action" =~ ^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)+@[0-9a-f]{40}$ ]]
}

# A valid tag ref: starts alphanumeric, then alphanumerics and . _ / + ~ -.
# Rejects glob metacharacters so the ref pattern given to git ls-remote can
# never be widened.
is_valid_tag() {
    local tag="$1"
    [[ "$tag" =~ ^[A-Za-z0-9][A-Za-z0-9._/+~-]*$ ]]
}

# The action's repository is always its first two path segments
# (owner/repo[/subaction]).
action_repo_slug() {
    local action="$1"
    local path="${action%%@*}"
    printf '%s\n' "$(printf '%s' "$path" | cut -d/ -f1-2)"
}

# Resolve the commit an upstream tag points at. Annotated tags advertise a
# peeled ref (tag object ≠ commit); lightweight tags are NOT peeled by the
# server, so fall back to the plain ref, whose SHA is the commit itself.
# Exactly one ref must resolve in either form.
resolve_tag_commit() {
    local repo_url="$1" tag="$2" out
    if out="$(git ls-remote "$repo_url" "refs/tags/${tag}^{}" 2>/dev/null)" \
        && [[ "$(printf '%s\n' "$out" | grep -c . || true)" -eq 1 ]]; then
        printf '%s\n' "$out" | awk 'NR==1 { print $1 }'
        return 0
    fi
    if out="$(git ls-remote "$repo_url" "refs/tags/${tag}" 2>/dev/null)" \
        && [[ "$(printf '%s\n' "$out" | grep -c . || true)" -eq 1 ]]; then
        printf '%s\n' "$out" | awk 'NR==1 { print $1 }'
        return 0
    fi
    return 1
}

# Verify <sha> is the commit that upstream <repo-url> tag <tag> points at.
# For an annotated tag the plain ref resolves to the tag OBJECT, not the
# commit, so it can only verify via the peeled form — a plain-ref equality
# can never falsely pass an annotated tag's object SHA as the commit.
verify_tag_commit() {
    local repo_url="$1" tag="$2" expected="$3" resolved
    resolved="$(resolve_tag_commit "$repo_url" "$tag")" || return 1
    [[ -n "$resolved" && "$resolved" == "$expected" ]]
}

# True when the exact action@sha entry already exists in the allowlist.
is_already_allowed() {
    local allowlist="$1" action="$2"
    grep -qF "\"${action}\"" "$allowlist"
}

main() {
    set -euo pipefail

    local diff_file="" pr="" allowlist="$DEFAULT_ALLOWLIST" dry_run=0
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --diff) diff_file="${2:-}"; shift 2 ;;
            --pr) pr="${2:-}"; shift 2 ;;
            --allowlist) allowlist="${2:-}"; shift 2 ;;
            --dry-run) dry_run=1; shift ;;
            -h|--help) usage; return 0 ;;
            *) err "unknown argument: $1"; usage; return 2 ;;
        esac
    done

    if [[ -z "$diff_file" && -n "$pr" ]]; then
        diff_file="$(mktemp)"
        gh pr diff "$pr" > "$diff_file"
    fi
    if [[ -z "$diff_file" ]]; then
        err "no diff source: pass --diff <file> or --pr <number>"
        usage
        return 2
    fi
    if [[ ! -f "$diff_file" && "$diff_file" != "/dev/stdin" ]]; then
        err "diff file not found: $diff_file"
        return 2
    fi
    if [[ ! -f "$allowlist" ]]; then
        err "allowlist file not found: $allowlist"
        return 2
    fi

    # Pass 1: validate everything first — no writes unless all entries verify.
    local -a to_add=()
    local action tag slug repo_url failures=0
    while IFS=$'\t' read -r action tag; do
        [[ -n "$action" ]] || continue
        if ! is_valid_action_sha "$action"; then
            err "malformed action pin in diff: $action"
            failures=$((failures + 1))
            continue
        fi
        if is_already_allowed "$allowlist" "$action"; then
            printf '  already allowlisted: %s\n' "$action"
            continue
        fi
        if [[ -z "$tag" ]]; then
            err "no version tag comment to verify against: $action"
            failures=$((failures + 1))
            continue
        fi
        if ! is_valid_tag "$tag"; then
            err "unusable version tag ref: $tag ($action)"
            failures=$((failures + 1))
            continue
        fi
        slug="$(action_repo_slug "$action")"
        repo_url="https://github.com/${slug}.git"
        if verify_tag_commit "$repo_url" "$tag" "${action##*@}"; then
            to_add+=("$action")
            ok "verified ${action} against upstream tag ${tag}"
        else
            err "SHA did not verify against ${slug} tag ${tag}: ${action}"
            failures=$((failures + 1))
        fi
    done < <(parse_added_uses "$diff_file")

    if [[ "$failures" -gt 0 ]]; then
        err "$failures verification failure(s) — allowlist left unchanged"
        return 1
    fi
    if [[ "${#to_add[@]}" -eq 0 ]]; then
        ok "nothing to allowlist"
        return 0
    fi

    if [[ "$dry_run" -eq 1 ]]; then
        printf 'would append to %s:\n' "$allowlist"
        local e
        for e in "${to_add[@]}"; do
            printf '    "%s"\n' "$e"
        done
        return 0
    fi

    # Pass 2: insert the verified entries BEFORE the ALLOWED_SHAS array's
    # closing ')' — the file continues below the array, so appending at EOF
    # would place entries outside it.
    local tmp e insert_line
    insert_line="$(grep -n '^)$' "$allowlist" | tail -n 1 | cut -d: -f1)"
    if [[ -z "$insert_line" ]]; then
        err "ALLOWED_SHAS array terminator not found — file left unchanged"
        return 1
    fi
    tmp="$(mktemp "${allowlist}.XXXXXX")"
    {
        head -n "$((insert_line - 1))" "$allowlist"
        printf '# Appended %s by scripts/allowlist-dependabot-shas.sh — verified against upstream annotated tags (ADR-247)\n' "$(date -u +%F)"
        for e in "${to_add[@]}"; do
            printf '    "%s"\n' "$e"
        done
        tail -n "+${insert_line}" "$allowlist"
    } > "$tmp"
    if ! bash -n "$tmp"; then
        err "appended allowlist failed bash syntax check — file left unchanged"
        rm -f "$tmp"
        return 1
    fi
    # shellcheck disable=SC1090
    if ! (source "$tmp"; for e in "${to_add[@]}"; do
        is_allowed_sha "$e" || exit 1
    done); then
        err "appended allowlist rejected its own new entries — file left unchanged"
        rm -f "$tmp"
        return 1
    fi
    mv "$tmp" "$allowlist"
    chmod 644 "$allowlist"
    ok "appended ${#to_add[@]} verified SHA entry(ies) to ${allowlist}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
