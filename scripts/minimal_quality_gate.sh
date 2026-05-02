#!/usr/bin/env bash
# Minimal quality gate for fast iteration.
# Runs only lint/typecheck — skips tests for rapid feedback.
# Exit 0 = success, Exit 2 = errors found.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

FAILED=0

# Detect package manager
if command -v pnpm &> /dev/null; then
    PM="pnpm"
    RUN="pnpm"
elif command -v npm &> /dev/null; then
    PM="npm"
    RUN="npm run"
else
    printf '%s⚠ No package manager found (pnpm/npm)%s\n' "${YELLOW}" "${NC}"
    exit 0
fi

printf '%sRunning minimal quality gate (lint + typecheck only)...%s\n' "${BLUE}" "${NC}"
echo ""

# Lint only
printf '%sRunning lint...%s\n' "${BLUE}" "${NC}"
if ! OUTPUT=$($RUN lint 2>&1); then
    printf '%s✗ %s lint failed%s\n' "${RED}" "$PM" "${NC}"
    echo "$OUTPUT" >&2
    FAILED=1
else
    printf '%s✓ %s lint passed%s\n' "${GREEN}" "$PM" "${NC}"
fi
echo ""

# Typecheck only (skip tests)
printf '%sRunning typecheck...%s\n' "${BLUE}" "${NC}"
if ! OUTPUT=$($RUN typecheck 2>&1); then
    printf '%s✗ %s typecheck failed%s\n' "${RED}" "$PM" "${NC}"
    echo "$OUTPUT" >&2
    FAILED=1
else
    printf '%s✓ %s typecheck passed%s\n' "${GREEN}" "$PM" "${NC}"
fi
echo ""

# Shell script checks (fast)
if command -v shellcheck &> /dev/null; then
    printf '%sRunning shellcheck...%s\n' "${BLUE}" "${NC}"
    SHELL_SCRIPTS=$(find . -path "./.git" -prune -o -path "./node_modules" -prune -o -path "./target" -prune -o -name "*.sh" -print 2>/dev/null || true)
    if [ -n "$SHELL_SCRIPTS" ]; then
        sc_failed=0
        while IFS= read -r script; do
            [ -n "$script" ] || continue
            if ! shellcheck --severity=error -f quiet "$script" 2>/dev/null; then
                printf '%s✗ shellcheck failed: %s%s\n' "${RED}" "$script" "${NC}"
                sc_failed=1
            fi
        done <<< "$SHELL_SCRIPTS"

        if [ $sc_failed -eq 0 ]; then
            printf '%s✓ shellcheck passed%s\n' "${GREEN}" "${NC}"
        else
            FAILED=1
        fi
    fi
fi
echo ""

# Result
if [ $FAILED -ne 0 ]; then
    printf '%s─────────────────────────────────────────────────────────────────%s\n' "${RED}" "${NC}"
    printf '%s│ ✗ Minimal Quality Gate FAILED                               │%s\n' "${RED}" "${NC}"
    printf '%s─────────────────────────────────────────────────────────────────%s\n' "${RED}" "${NC}"
    echo ""
    echo "Fix the errors above. Run full quality gate before commit:"
    echo "  ./scripts/quality_gate.sh"
    exit 2
fi

printf '%s─────────────────────────────────────────────────────────────────%s\n' "${GREEN}" "${NC}"
printf '%s│ ✓ Minimal Quality Gate PASSED                                │%s\n' "${GREEN}" "${NC}"
printf '%s─────────────────────────────────────────────────────────────────%s\n' "${GREEN}" "${NC}"
echo ""
echo "Lint + typecheck passed. Run full quality gate before commit:"
echo "  ./scripts/quality_gate.sh"
