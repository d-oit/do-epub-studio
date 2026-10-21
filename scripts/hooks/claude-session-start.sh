#!/usr/bin/env bash
# Claude Code SessionStart hook (GOAP-276 Phase 2).
#
# Injects the repository documentation index (root `llms.txt`) and the top
# changelog section (root `CHANGELOG.md`) into the session context, so an
# agent starts with the repository's own map of the codebase and of the work
# currently in flight.
#
# Registered in `.claude/settings.json` as a `SessionStart` command hook. The
# script prints exactly one JSON object on stdout:
#
#   {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}
#
# Claude Code adds `additionalContext` to the conversation before the first
# prompt, so the output is session context, not a log line.
#
# The hook is local-only and deterministic: it reads two files inside the
# repository, runs no network command, and prints no environment value.
set -euo pipefail

# Byte budgets for the injected context. Claude Code replaces an
# `additionalContext` longer than 10,000 characters with a file path plus a
# 2,000-character preview, so the total (6000 + 2500 bytes of content plus
# roughly 400 bytes of framing) stays well below that limit.
readonly INDEX_MAX_BYTES=6000
readonly CHANGELOG_MAX_BYTES=2500

# Byte-accurate counting and truncation (no locale-dependent character
# widths), so the same files always produce the same output.
export LC_ALL=C

# Populated by bounded_section().
SECTION_TEXT=""
SECTION_TRUNCATED=0
SECTION_TOTAL_BYTES=0

# Scratch file for the byte-exact section content; removed on exit.
SCRATCH=""

cleanup() {
    if [[ -n "$SCRATCH" && -f "$SCRATCH" ]]; then
        rm -f "$SCRATCH"
    fi
}
trap cleanup EXIT

# --- repository root -------------------------------------------------------

# Resolve the repository root so the hook also works inside a git worktree.
# `git rev-parse --show-toplevel` reports the tree the session runs in, while
# the script's own location reports the checkout that holds the script. The
# git answer wins when it actually carries the documentation files; the
# script location is the fallback for a non-git context (fresh copy, tests).
resolve_repo_root() {
    local script_root git_root
    script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
    git_root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"
    if [[ -n "$git_root" && -f "$git_root/llms.txt" ]]; then
        printf '%s' "$git_root"
        return 0
    fi
    printf '%s' "$script_root"
}

# --- bounded sections ------------------------------------------------------

# Read stdin into SECTION_TEXT, keeping at most $1 bytes and cutting on a
# line boundary. Sets SECTION_TEXT, SECTION_TRUNCATED and SECTION_TOTAL_BYTES.
#
# The cut is line-aligned on purpose: a byte cut could split a multi-byte
# UTF-8 character and leave the injected context undecodable.
bounded_section() {
    local max="$1" total

    cat >"$SCRATCH"
    total="$(wc -c <"$SCRATCH" | tr -d '[:space:]')"
    SECTION_TOTAL_BYTES="$total"

    if ((total <= max)); then
        # The `printf X` sentinel keeps command substitution from stripping
        # the file's trailing newlines.
        SECTION_TEXT="$(cat "$SCRATCH"; printf X)"
        SECTION_TEXT="${SECTION_TEXT%X}"
        SECTION_TRUNCATED=0
        return 0
    fi

    SECTION_TRUNCATED=1
    SECTION_TEXT="$(awk -v max="$max" '
        {
            line = $0 ORS
            if (used + length(line) <= max) {
                used += length(line)
                printf "%s", line
                next
            }
            exit
        }
    ' "$SCRATCH"; printf X)"
    SECTION_TEXT="${SECTION_TEXT%X}"

    if [[ -z "$SECTION_TEXT" ]]; then
        # A single line longer than the budget: fall back to a byte prefix
        # and drop any incomplete trailing UTF-8 sequence.
        SECTION_TEXT="$(head -c "$max" "$SCRATCH" | iconv -f UTF-8 -t UTF-8 -c 2>/dev/null || true)"
        if [[ -z "$SECTION_TEXT" ]]; then
            SECTION_TEXT="$(head -c "$max" "$SCRATCH")"
        fi
    fi
}

# Print the topmost "## " section of a changelog file. For this repository
# that is the `## [Unreleased]` section — the work currently in flight.
changelog_section() {
    awk '
        /^## / {
            if (seen) { exit }
            seen = 1
            print
            next
        }
        seen { print }
    ' "$1"
}

# Escape a string for use inside a JSON string literal.
json_escape() {
    local s="$1"
    s=${s//\\/\\\\}
    s=${s//\"/\\\"}
    s=${s//$'\t'/\\t}
    s=${s//$'\r'/\\r}
    s=${s//$'\n'/\\n}
    s=${s//$'\f'/\\f}
    s=${s//$'\b'/\\b}
    s=${s//[[:cntrl:]]/}
    printf '%s' "$s"
}

# --- context assembly ------------------------------------------------------

# Build the context text for the resolved repository root.
build_context() {
    local root="$1"
    local index_body="" changelog_body=""
    local context="" missing_list=""
    local -a missing=()

    if [[ -f "$root/llms.txt" ]]; then
        bounded_section "$INDEX_MAX_BYTES" <"$root/llms.txt"
        index_body="$SECTION_TEXT"
        if ((SECTION_TRUNCATED == 1)); then
            index_body="$index_body
[truncated: llms.txt is ${SECTION_TOTAL_BYTES} bytes; ${INDEX_MAX_BYTES} bytes shown - read llms.txt for the full index]"
        fi
    else
        missing+=("llms.txt")
    fi

    if [[ -f "$root/CHANGELOG.md" ]]; then
        bounded_section "$CHANGELOG_MAX_BYTES" < <(changelog_section "$root/CHANGELOG.md")
        changelog_body="$SECTION_TEXT"
        if ((SECTION_TRUNCATED == 1)); then
            changelog_body="$changelog_body
[truncated: the top CHANGELOG.md section is ${SECTION_TOTAL_BYTES} bytes; ${CHANGELOG_MAX_BYTES} bytes shown - read CHANGELOG.md for the full section]"
        fi
    else
        missing+=("CHANGELOG.md")
    fi

    if [[ -n "$index_body" ]]; then
        context="Repository documentation index (llms.txt):

$index_body"
    fi

    if [[ -n "$changelog_body" ]]; then
        if [[ -n "$context" ]]; then
            context="$context

Latest changelog section (CHANGELOG.md):

$changelog_body"
        else
            context="Latest changelog section (CHANGELOG.md):

$changelog_body"
        fi
    fi

    if ((${#missing[@]} > 0)); then
        missing_list="$(printf '%s, ' "${missing[@]}")"
        missing_list="${missing_list%, }"
        context="$context

($missing_list was not found in the repository root.)"
    fi

    printf '%s' "$context"
}

# --- entry point -----------------------------------------------------------

main() {
    local root context escaped
    SCRATCH="$(mktemp)"
    # Drain the hook input JSON so Claude Code's writer never sees EPIPE.
    # Skipped on a terminal so a manual run does not block on stdin.
    if [[ ! -t 0 ]]; then
        cat >/dev/null 2>&1 || true
    fi
    root="$(resolve_repo_root)"
    context="$(build_context "$root")"
    escaped="$(json_escape "$context")"
    printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$escaped"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
