#!/usr/bin/env bash
# Shared color definitions with TTY-aware output.
# Source: source "$REPO_ROOT/scripts/lib/colors.sh"
# Colors are disabled when stdout is not a terminal or FORCE_COLOR=0.

if [[ -z "${REPO_ROOT:-}" ]]; then
    REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi

# TTY check: only emit ANSI codes when stdout is a terminal
if [[ -t 1 ]] && [[ "${FORCE_COLOR:-}" != "0" ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    BOLD=''
    NC=''
fi
