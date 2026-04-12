#!/usr/bin/env bash
# Shared color definitions with TTY-aware output.
# Source: source "$REPO_ROOT/scripts/lib/colors.sh"
# Colors are disabled when stdout is not a terminal or FORCE_COLOR=0.
#
# Uses tput for portable, reliable ANSI code generation.
# Falls back to empty strings when not a TTY.

if [[ -z "${REPO_ROOT:-}" ]]; then
    REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi

# TTY check: only emit ANSI codes when stdout is a terminal
if [[ -t 1 ]] && [[ "${FORCE_COLOR:-}" != "0" ]]; then
    if command -v tput &> /dev/null; then
        RED=$(tput setaf 1)
        GREEN=$(tput setaf 2)
        YELLOW=$(tput setaf 3)
        BLUE=$(tput setaf 4)
        BOLD=$(tput bold)
        NC=$(tput sgr0)
    else
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        BLUE='\033[0;34m'
        BOLD='\033[1m'
        NC='\033[0m'
    fi
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    BOLD=''
    NC=''
fi
