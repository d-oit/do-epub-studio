#!/usr/bin/env bash
# Secondary language phases of scripts/quality_gate.sh, sourced by it.
#
# Split out to keep quality_gate.sh under the 500-line cap (ADR-278); the gate
# itself is a live demo of the shrink-only ratchet. Expects REPO_ROOT, FAILED,
# SKIPPED and DETECTED_LANGAGES from the caller, and the colour vars.

# FAILED/SKIPPED are written here and read by the sourcing gate; shellcheck
# cannot follow them across the `source`, so scope the suppression here.
# shellcheck disable=SC2034

# Python checks
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " python " ]]; then
    printf '%sRunning Python checks...%s\n' "${BLUE}" "${NC}"

    if command -v ruff &> /dev/null; then
        if ! OUTPUT=$(ruff check . 2>&1); then
            printf '%s  ✗ ruff check failed%s\n' "${RED}" "${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            printf '%s  ✓ ruff check passed%s\n' "${GREEN}" "${NC}"
        fi
    else
        printf '%s  ⚠ ruff not installed - skipping Python lint%s\n' "${YELLOW}" "${NC}"
    fi

    if command -v black &> /dev/null; then
        if ! OUTPUT=$(black --check . 2>&1); then
            printf '%s  ✗ black check failed%s\n' "${RED}" "${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            printf '%s  ✓ black check passed%s\n' "${GREEN}" "${NC}"
        fi
    else
        printf '%s  ⚠ black not installed - skipping Python format%s\n' "${YELLOW}" "${NC}"
    fi

    # pytest — always run if tests/ directory exists
    if [ -d "tests" ]; then
        if command -v pytest &> /dev/null; then
            if ! OUTPUT=$(pytest tests/ -q 2>&1); then
                printf '%s  ✗ pytest failed%s\n' "${RED}" "${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                printf '%s  ✓ pytest passed%s\n' "${GREEN}" "${NC}"
            fi
        else
            printf '%s  ⚠ pytest not installed - skipping Python tests%s\n' "${YELLOW}" "${NC}"
        fi
    fi
    echo ""
fi

# Guard: prevent .gitignore deletions
if ! "$REPO_ROOT/scripts/guard-gitignore.sh"; then
    FAILED=1
fi
echo ""

# Shell script checks
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " shell " ]]; then
    printf '%sRunning Shell script checks...%s\n' "${BLUE}" "${NC}"

    if command -v shellcheck &> /dev/null; then
        SHELL_SCRIPTS=$(find . -path "./.git" -prune -o -path "./node_modules" -prune -o -path "./target" -prune -o -name "*.sh" -print 2>/dev/null || true)
        if [ -n "$SHELL_SCRIPTS" ]; then
            sc_failed=0
            while IFS= read -r script; do
                [ -n "$script" ] || continue
                if ! shellcheck --severity=error -f quiet "$script" 2>/dev/null; then
                    printf '%s  ✗ shellcheck failed: %s%s\n' "${RED}" "$script" "${NC}"
                    sc_failed=1
                fi
            done <<< "$SHELL_SCRIPTS"

            if [ $sc_failed -eq 0 ]; then
                printf '%s  ✓ shellcheck passed%s\n' "${GREEN}" "${NC}"
            else
                FAILED=1
            fi
        fi
    else
        printf '%s  ⚠ shellcheck not installed - skipping shell checks%s\n' "${YELLOW}" "${NC}"
    fi

    # BATS tests — always run if tests/ or scripts/tests/ directory exists
    if { [ -d "tests" ] || [ -d "scripts/tests" ]; } && [ -z "${BATS_TEST_FILENAME:-}" ]; then
        if command -v bats &> /dev/null; then
            BATS_DIRS=()
            [ -d "tests" ] && BATS_DIRS+=("tests/")
            [ -d "scripts/tests" ] && BATS_DIRS+=("scripts/tests/")
            if ! OUTPUT=$(bats "${BATS_DIRS[@]}" 2>&1); then
                printf '%s  ✗ bats tests failed%s\n' "${RED}" "${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                printf '%s  ✓ bats tests passed%s\n' "${GREEN}" "${NC}"
            fi
        else
            printf '%s  ⚠ bats not installed - skipping shell tests%s\n' "${YELLOW}" "${NC}"
        fi
    fi
    echo ""
fi
