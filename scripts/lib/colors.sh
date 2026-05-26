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
        RED=$(tput setaf 1 2>/dev/null || true)
        GREEN=$(tput setaf 2 2>/dev/null || true)
        YELLOW=$(tput setaf 3 2>/dev/null || true)
        BLUE=$(tput setaf 4 2>/dev/null || true)
        BOLD=$(tput bold 2>/dev/null || true)
        NC=$(tput sgr0 2>/dev/null || true)
    fi
    # Fallback to standard ANSI codes if tput didn't work or generated empty variables
    if [[ -z "${RED:-}" ]]; then
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        BLUE='\033[0;34m'
        BOLD='\033[1m'
        NC='\033[0m'
    fi
else
    RED=''
    export GREEN=''
    export YELLOW=''
    export BLUE=''
    export BOLD=''
    export NC=''
fi
