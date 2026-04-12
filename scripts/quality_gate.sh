#!/usr/bin/env bash
# Full quality gate with auto-detection for multiple languages.
# Exit 0 = silent success, Exit 2 = errors surfaced to agent.
# Used in pre-commit hook and CI.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

# FAILED acts as an error accumulator
FAILED=0

# DETECTED_LANGUAGES stores which language ecosystems are present
DETECTED_LANGUAGES=()

echo "Running quality gate..."
echo ""

# --- Validate git hooks configuration ---
if [ "${SKIP_GLOBAL_HOOKS_CHECK:-false}" != "true" ]; then
    printf '%sValidating git hooks configuration...%s\n' "${BLUE}" "${NC}"
    if ! "$REPO_ROOT/scripts/validate-git-hooks.sh" 2>&1; then
        printf '%s⚠ Git hooks config warning (non-blocking)%s\n' "${YELLOW}" "${NC}"
        FAILED=1
    fi
    echo ""
fi

# --- Validate GitHub Actions SHAs ---
printf '%sValidating GitHub Actions SHAs...%s\n' "${BLUE}" "${NC}"
if ! "$REPO_ROOT/scripts/validate-github-actions-shas.sh"; then
    FAILED=1
fi
echo ""

# --- Validate skill symlinks ---
printf '%sValidating skill symlinks...%s\n' "${BLUE}" "${NC}"
if ! "$REPO_ROOT/scripts/validate-skills.sh"; then
    FAILED=1
fi
echo ""

# --- Validate SKILL.md format ---
printf '%sValidating SKILL.md format...%s\n' "${BLUE}" "${NC}"
if [ -f "$REPO_ROOT/scripts/validate-skill-format.sh" ]; then
    if ! "$REPO_ROOT/scripts/validate-skill-format.sh"; then
        FAILED=1
    fi
fi
echo ""

# --- Validate reference links in SKILL.md files ---
printf '%sValidating reference links in SKILL.md files...%s\n' "${BLUE}" "${NC}"
if [ -f "$REPO_ROOT/scripts/validate-links.sh" ]; then
    if ! "$REPO_ROOT/scripts/validate-links.sh"; then
        FAILED=1
    fi
fi
echo ""

# --- Auto-detect project languages ---
printf '%sDetecting project languages...%s\n' "${BLUE}" "${NC}"

# TypeScript/JavaScript detection via package.json
if [ -f "package.json" ]; then
    printf '  %s✓%s TypeScript/JavaScript (package.json)\n' "${GREEN}" "${NC}"
    DETECTED_LANGUAGES+=("typescript")
fi

# Python detection
if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
    printf '  %s✓%s Python (requirements.txt/pyproject.toml)\n' "${GREEN}" "${NC}"
    DETECTED_LANGUAGES+=("python")
fi

# Shell script detection — exclude non-source directories
if find . -path "./.git" -prune -o -path "./node_modules" -prune -o -path "./target" -prune -o -name "*.sh" -print | grep -q .; then
    printf '  %s✓%s Shell scripts detected\n' "${GREEN}" "${NC}"
    DETECTED_LANGUAGES+=("shell")
fi

# Markdown detection — exclude non-source directories
if find . -path "./.git" -prune -o -path "./node_modules" -prune -o -path "./target" -prune -o -name "*.md" -print | grep -q .; then
    printf '  %s✓%s Markdown files detected\n' "${GREEN}" "${NC}"
    DETECTED_LANGUAGES+=("markdown")
fi

if [ ${#DETECTED_LANGUAGES[@]} -eq 0 ]; then
    printf '%s  No recognized project files found.%s\n' "${YELLOW}" "${NC}"
    echo "  Add package.json, requirements.txt, pyproject.toml, or source files."
fi
echo ""

# --- Run language-specific checks ---

if [[ " ${DETECTED_LANGUAGES[*]} " =~ " typescript " ]]; then
    printf '%sRunning TypeScript/JavaScript checks...%s\n' "${BLUE}" "${NC}"

    # Determine which package manager is available
    if command -v pnpm &> /dev/null; then
        PM="pnpm"
    elif command -v npm &> /dev/null; then
        PM="npm"
    else
        printf '%s  ⚠ pnpm/npm not installed - skipping TypeScript checks%s\n' "${YELLOW}" "${NC}"
        PM=""
    fi

    if [[ -n "$PM" ]]; then
        if [[ "$PM" == "pnpm" ]]; then
            RUN="pnpm"
        else
            RUN="npm run"
        fi

        # Lint
        if ! OUTPUT=$($RUN lint 2>&1); then
            printf '%s  ✗ %s lint failed%s\n' "${RED}" "$PM" "${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            printf '%s  ✓ %s lint passed%s\n' "${GREEN}" "$PM" "${NC}"
        fi

        # Typecheck
        if ! OUTPUT=$($RUN typecheck 2>&1); then
            printf '%s  ✗ %s typecheck failed%s\n' "${RED}" "$PM" "${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            printf '%s  ✓ %s typecheck passed%s\n' "${GREEN}" "$PM" "${NC}"
        fi

        # Tests
        if [ "${SKIP_TESTS:-false}" != "true" ]; then
            if ! OUTPUT=$($PM test 2>&1); then
                printf '%s  ✗ %s test failed%s\n' "${RED}" "$PM" "${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                printf '%s  ✓ %s test passed%s\n' "${GREEN}" "$PM" "${NC}"
            fi
        fi
    fi
    echo ""
fi

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

    # pytest — only if tests/ directory exists
    if [ "${SKIP_TESTS:-false}" != "true" ] && [ -d "tests" ]; then
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

    # BATS tests — only if tests/ directory exists and not already in BATS
    if [ -d "tests" ] && [ "${SKIP_TESTS:-false}" != "true" ] && [ -z "${BATS_TEST_FILENAME:-}" ]; then
        if command -v bats &> /dev/null; then
            if ! OUTPUT=$(bats tests/ 2>&1); then
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

# Markdown checks
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " markdown " ]]; then
    printf '%sRunning Markdown checks...%s\n' "${BLUE}" "${NC}"

    if command -v markdownlint &> /dev/null; then
        MD_FILES=$(find . -path "./node_modules" -prune -o -path "./target" -prune -o -path "./.git" -prune -o -name "*.md" -print 2>/dev/null || true)
        if [ -n "$MD_FILES" ]; then
            md_failed=0
            while IFS= read -r md_file; do
                [ -n "$md_file" ] || continue
                if ! markdownlint "$md_file" 2>&1; then
                    printf '%s  ✗ markdownlint failed: %s%s\n' "${RED}" "$md_file" "${NC}"
                    md_failed=1
                fi
            done <<< "$MD_FILES"

            if [ $md_failed -eq 0 ]; then
                printf '%s  ✓ markdownlint passed%s\n' "${GREEN}" "${NC}"
            else
                FAILED=1
            fi
        fi
    else
        printf '%s  ⚠ markdownlint not installed - skipping markdown checks%s\n' "${YELLOW}" "${NC}"
    fi
    echo ""
fi

# --- Final result ---
if [ $FAILED -ne 0 ]; then
    printf '%s─────────────────────────────────────────────────────────────────%s\n' "${RED}" "${NC}"
    printf '%s│ ✗ Quality Gate FAILED                                         │%s\n' "${RED}" "${NC}"
    printf '%s─────────────────────────────────────────────────────────────────%s\n' "${RED}" "${NC}"
    echo ""
    echo "Fix the errors above and re-run quality gate."
    echo "Use SKIP_TESTS=true to skip test checks."
    exit 2
fi

printf '%s─────────────────────────────────────────────────────────────────%s\n' "${GREEN}" "${NC}"
printf '%s│ ✓ All Quality Gates PASSED                                    │%s\n' "${GREEN}" "${NC}"
printf '%s─────────────────────────────────────────────────────────────────%s\n' "${GREEN}" "${NC}"
echo ""
echo "Languages checked: ${DETECTED_LANGUAGES[*]}"
