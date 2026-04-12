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
    echo -e "${BLUE}Validating git hooks configuration...${NC}"
    if ! "$REPO_ROOT/scripts/validate-git-hooks.sh" 2>&1; then
        echo -e "${YELLOW}⚠ Git hooks config warning (non-blocking)${NC}"
        FAILED=1
    fi
    echo ""
fi

# --- Validate GitHub Actions SHAs ---
echo -e "${BLUE}Validating GitHub Actions SHAs...${NC}"
if ! "$REPO_ROOT/scripts/validate-github-actions-shas.sh"; then
    FAILED=1
fi
echo ""

# --- Validate skill symlinks ---
echo -e "${BLUE}Validating skill symlinks...${NC}"
if ! "$REPO_ROOT/scripts/validate-skills.sh"; then
    FAILED=1
fi
echo ""

# --- Validate SKILL.md format ---
echo -e "${BLUE}Validating SKILL.md format...${NC}"
if [ -f "$REPO_ROOT/scripts/validate-skill-format.sh" ]; then
    if ! "$REPO_ROOT/scripts/validate-skill-format.sh"; then
        FAILED=1
    fi
fi
echo ""

# --- Validate reference links in SKILL.md files ---
echo -e "${BLUE}Validating reference links in SKILL.md files...${NC}"
if [ -f "$REPO_ROOT/scripts/validate-links.sh" ]; then
    if ! "$REPO_ROOT/scripts/validate-links.sh"; then
        FAILED=1
    fi
fi
echo ""

# --- Auto-detect project languages ---
echo -e "${BLUE}Detecting project languages...${NC}"

# TypeScript/JavaScript detection via package.json
if [ -f "package.json" ]; then
    echo "  ${GREEN}✓${NC} TypeScript/JavaScript (package.json)"
    DETECTED_LANGUAGES+=("typescript")
fi

# Python detection
if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
    echo "  ${GREEN}✓${NC} Python (requirements.txt/pyproject.toml)"
    DETECTED_LANGUAGES+=("python")
fi

# Shell script detection — exclude non-source directories
if find . -path "./.git" -prune -o -path "./node_modules" -prune -o -path "./target" -prune -o -name "*.sh" -print | grep -q .; then
    echo "  ${GREEN}✓${NC} Shell scripts detected"
    DETECTED_LANGUAGES+=("shell")
fi

# Markdown detection — exclude non-source directories
if find . -path "./.git" -prune -o -path "./node_modules" -prune -o -path "./target" -prune -o -name "*.md" -print | grep -q .; then
    echo "  ${GREEN}✓${NC} Markdown files detected"
    DETECTED_LANGUAGES+=("markdown")
fi

if [ ${#DETECTED_LANGUAGES[@]} -eq 0 ]; then
    echo -e "${YELLOW}  No recognized project files found.${NC}"
    echo "  Add package.json, requirements.txt, pyproject.toml, or source files."
fi
echo ""

# --- Run language-specific checks ---

if [[ " ${DETECTED_LANGUAGES[*]} " =~ " typescript " ]]; then
    echo -e "${BLUE}Running TypeScript/JavaScript checks...${NC}"

    # Determine which package manager is available
    if command -v pnpm &> /dev/null; then
        PM="pnpm"
    elif command -v npm &> /dev/null; then
        PM="npm"
    else
        echo -e "${YELLOW}  ⚠ pnpm/npm not installed - skipping TypeScript checks${NC}"
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
            echo -e "${RED}  ✗ $PM lint failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ $PM lint passed${NC}"
        fi

        # Typecheck
        if ! OUTPUT=$($RUN typecheck 2>&1); then
            echo -e "${RED}  ✗ $PM typecheck failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ $PM typecheck passed${NC}"
        fi

        # Tests
        if [ "${SKIP_TESTS:-false}" != "true" ]; then
            if ! OUTPUT=$($PM test 2>&1); then
                echo -e "${RED}  ✗ $PM test failed${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                echo -e "${GREEN}  ✓ $PM test passed${NC}"
            fi
        fi
    fi
    echo ""
fi

# Python checks
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " python " ]]; then
    echo -e "${BLUE}Running Python checks...${NC}"

    if command -v ruff &> /dev/null; then
        if ! OUTPUT=$(ruff check . 2>&1); then
            echo -e "${RED}  ✗ ruff check failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ ruff check passed${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ ruff not installed - skipping Python lint${NC}"
    fi

    if command -v black &> /dev/null; then
        if ! OUTPUT=$(black --check . 2>&1); then
            echo -e "${RED}  ✗ black check failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ black check passed${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ black not installed - skipping Python format${NC}"
    fi

    # pytest — only if tests/ directory exists
    if [ "${SKIP_TESTS:-false}" != "true" ] && [ -d "tests" ]; then
        if command -v pytest &> /dev/null; then
            if ! OUTPUT=$(pytest tests/ -q 2>&1); then
                echo -e "${RED}  ✗ pytest failed${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                echo -e "${GREEN}  ✓ pytest passed${NC}"
            fi
        else
            echo -e "${YELLOW}  ⚠ pytest not installed - skipping Python tests${NC}"
        fi
    fi
    echo ""
fi

# Shell script checks
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " shell " ]]; then
    echo -e "${BLUE}Running Shell script checks...${NC}"

    if command -v shellcheck &> /dev/null; then
        SHELL_SCRIPTS=$(find . -path "./.git" -prune -o -path "./node_modules" -prune -o -path "./target" -prune -o -name "*.sh" -print 2>/dev/null || true)
        if [ -n "$SHELL_SCRIPTS" ]; then
            sc_failed=0
            while IFS= read -r script; do
                [ -n "$script" ] || continue
                if ! shellcheck --severity=error -f quiet "$script" 2>/dev/null; then
                    echo -e "${RED}  ✗ shellcheck failed: $script${NC}"
                    sc_failed=1
                fi
            done <<< "$SHELL_SCRIPTS"

            if [ $sc_failed -eq 0 ]; then
                echo -e "${GREEN}  ✓ shellcheck passed${NC}"
            else
                FAILED=1
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ shellcheck not installed - skipping shell checks${NC}"
    fi

    # BATS tests — only if tests/ directory exists and not already in BATS
    if [ -d "tests" ] && [ "${SKIP_TESTS:-false}" != "true" ] && [ -z "${BATS_TEST_FILENAME:-}" ]; then
        if command -v bats &> /dev/null; then
            if ! OUTPUT=$(bats tests/ 2>&1); then
                echo -e "${RED}  ✗ bats tests failed${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                echo -e "${GREEN}  ✓ bats tests passed${NC}"
            fi
        else
            echo -e "${YELLOW}  ⚠ bats not installed - skipping shell tests${NC}"
        fi
    fi
    echo ""
fi

# Markdown checks
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " markdown " ]]; then
    echo -e "${BLUE}Running Markdown checks...${NC}"

    if command -v markdownlint &> /dev/null; then
        MD_FILES=$(find . -path "./node_modules" -prune -o -path "./target" -prune -o -path "./.git" -prune -o -name "*.md" -print 2>/dev/null || true)
        if [ -n "$MD_FILES" ]; then
            md_failed=0
            while IFS= read -r md_file; do
                [ -n "$md_file" ] || continue
                if ! markdownlint "$md_file" 2>&1; then
                    echo -e "${RED}  ✗ markdownlint failed: $md_file${NC}"
                    md_failed=1
                fi
            done <<< "$MD_FILES"

            if [ $md_failed -eq 0 ]; then
                echo -e "${GREEN}  ✓ markdownlint passed${NC}"
            else
                FAILED=1
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ markdownlint not installed - skipping markdown checks${NC}"
    fi
    echo ""
fi

# --- Final result ---
if [ $FAILED -ne 0 ]; then
    echo -e "${RED}─────────────────────────────────────────────────────────────────${NC}"
    echo -e "${RED}│ ✗ Quality Gate FAILED                                         │${NC}"
    echo -e "${RED}─────────────────────────────────────────────────────────────────${NC}"
    echo ""
    echo "Fix the errors above and re-run quality gate."
    echo "Use SKIP_TESTS=true to skip test checks."
    exit 2
fi

echo -e "${GREEN}─────────────────────────────────────────────────────────────────${NC}"
echo -e "${GREEN}│ ✓ All Quality Gates PASSED                                    │${NC}"
echo -e "${GREEN}─────────────────────────────────────────────────────────────────${NC}"
echo ""
echo "Languages checked: ${DETECTED_LANGUAGES[*]}"
