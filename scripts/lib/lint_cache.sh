#!/usr/bin/env bash

# File-hash cache for linters to skip unchanged files.
# Stored in .git/lint-cache/ (or .lint-cache/ if not a git repo).
# Source: source "$REPO_ROOT/scripts/lib/lint_cache.sh"

# Ensure REPO_ROOT is set — use already-defined value if available
if [ -z "${REPO_ROOT:-}" ]; then
    REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi

# Define CACHE_DIR — relative to .git
# We use git rev-parse to find the real .git dir (handles worktrees/submodules)
if command -v git &> /dev/null && git -C "$REPO_ROOT" rev-parse --git-dir &> /dev/null; then
    GIT_DIR=$(git -C "$REPO_ROOT" rev-parse --git-dir)
    # If GIT_DIR is relative, make it absolute relative to REPO_ROOT
    if [[ "$GIT_DIR" != /* ]]; then
        GIT_DIR="$REPO_ROOT/$GIT_DIR"
    fi
    CACHE_DIR="$GIT_DIR/lint-cache"
else
    # Fallback if not in a git repo
    CACHE_DIR="$REPO_ROOT/.lint-cache"
fi

mkdir -p "$CACHE_DIR"

# Portable hash computation — prefers sha256sum, falls back through
# shasum, md5sum, md5, and finally cksum (always available on POSIX).
_get_hash() {
    local file="$1"
    if [ ! -f "$file" ]; then
        echo "none"
        return
    fi
    if command -v sha256sum &> /dev/null; then
        sha256sum "$file" | cut -d' ' -f1
    elif command -v shasum &> /dev/null; then
        shasum -a 256 "$file" | cut -d' ' -f1
    elif command -v md5sum &> /dev/null; then
        md5sum "$file" | cut -d' ' -f1
    elif command -v md5 &> /dev/null; then
        md5 -q "$file" 2>/dev/null || md5 "$file" | awk '{print $NF}'
    elif command -v cksum &> /dev/null; then
        cksum "$file" | awk '{print $1 "_" $2}'
    else
        # Last resort: file size + modification time
        # shellcheck disable=SC2012
        stat -c '%s_%Y' "$file" 2>/dev/null || stat -f '%z_%m' "$file" 2>/dev/null || echo "fallback_$(date +%s)"
    fi
}

lint_if_changed() {
    local file="$1"
    local tool_id="$2"
    local config_file="$3"
    shift 3
    # The remaining arguments are the command to run

    # Compute hashes using the portable helper
    local file_hash
    file_hash=$(_get_hash "$file")

    local config_hash="none"
    if [ -n "$config_file" ]; then
        # Check if config_file is absolute or relative to REPO_ROOT
        if [[ "$config_file" == /* ]]; then
            config_hash=$(_get_hash "$config_file")
        elif [ -f "$REPO_ROOT/$config_file" ]; then
            config_hash=$(_get_hash "$REPO_ROOT/$config_file")
        elif [ -f "$config_file" ]; then
            config_hash=$(_get_hash "$config_file")
        fi
    fi

    local cache_value="${file_hash}:${config_hash}"

    # Use a safe filename for the cache key
    local safe_file
    safe_file=$(echo "$file" | tr '/. ' '___')
    local cache_key="$CACHE_DIR/${tool_id}_${safe_file}"

    # Check cache
    if [[ -f "$cache_key" ]] && [[ "$(cat "$cache_key")" == "$cache_value" ]]; then
        return 0  # Unchanged, skip
    fi

    # Run the command
    if "$@"; then
        echo "$cache_value" > "$cache_key"
        return 0
    else
        # If it failed, don't update the cache so it runs again next time
        rm -f "$cache_key"
        return 1
    fi
}
