#!/usr/bin/env bash
# Full quality gate with auto-detection for multiple languages.
# Exit 0 = silent success, Exit 2 = errors surfaced to agent.
# Used in pre-commit hook and CI.
# NOTE: errexit disabled explicitly - it causes unpredictable failures in CI
# Why +e instead of -e? We need to capture command output before exiting,
# and we aggregate all failures before deciding the final exit code.
set +e
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Source lint-cache library
# shellcheck source=scripts/lib/lint_cache.sh
if [ -f "$REPO_ROOT/scripts/lib/lint_cache.sh" ]; then
    # shellcheck source=scripts/lib/lint_cache.sh
    source "$REPO_ROOT/scripts/lib/lint_cache.sh"
fi

# Colors for output (disabled in CI via TTY check, or via FORCE_COLOR=0)
# TTY check (-t 1): Determines if stdout is a terminal (not redirected to file/pipe)
# This prevents ANSI codes from appearing in CI logs while keeping colors for local dev
if [[ -t 1 ]] && [[ "${FORCE_COLOR:-}" != "0" ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# FAILED acts as an error accumulator - any failed check sets this to 1
# We don't exit immediately so we can report ALL issues, not just the first
FAILED=0

# DETECTED_LANGUAGES stores which language ecosystems are present in the repo
# We use this array to conditionally run only relevant checks
DETECTED_LANGUAGES=()

echo "Running quality gate..."
echo ""

# --- Validate git hooks configuration (prevent global hooks from overriding local) ---
if [ "${SKIP_GLOBAL_HOOKS_CHECK:-false}" != "true" ]; then
    echo -e "${BLUE}Validating git hooks configuration...${NC}"
    if ! "$REPO_ROOT/scripts/validate-git-hooks.sh"; then
        # Don't fail the quality gate, just warn
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

# --- Always: validate skill symlinks ---
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
# We detect languages by checking for ecosystem-specific marker files.
# This avoids running Rust checks on a Python project, for example.
echo -e "${BLUE}Detecting project languages...${NC}"

# TypeScript/JavaScript detection via package.json
if [ -f "package.json" ]; then
    echo "  ${GREEN}✓${NC} TypeScript/JavaScript (package.json)"
    DETECTED_LANGUAGES+=("typescript")
fi

# Python detection - multiple valid project files
if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
    echo "  ${GREEN}✓${NC} Python (requirements.txt/pyproject.toml)"
    DETECTED_LANGUAGES+=("python")
fi

# Shell script detection via file existence
if find . -name "*.sh" -not -path "./.git/*" | grep -q .; then
    echo "  ${GREEN}✓${NC} Shell scripts detected"
    DETECTED_LANGUAGES+=("shell")
fi

# Markdown detection via file existence
if find . -name "*.md" -not -path "./.git/*" | grep -q .; then
    echo "  ${GREEN}✓${NC} Markdown files detected"
    DETECTED_LANGUAGES+=("markdown")
fi

if [ ${#DETECTED_LANGUAGES[@]} -eq 0 ]; then
    echo -e "${YELLOW}  No recognized project files found.${NC}"
    echo "  Add package.json, requirements.txt, pyproject.toml, or source files."
fi
echo ""

# --- Run language-specific checks ---

# TypeScript / JavaScript checks
# Prefers pnpm (faster, disk efficient) but falls back to npm if pnpm unavailable
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " typescript " ]]; then
    echo -e "${BLUE}Running TypeScript/JavaScript checks...${NC}"

    # Check for pnpm first (preferred package manager)
    if command -v pnpm &> /dev/null; then
        # Lint: Runs ESLint or configured linter via "pnpm lint" script
        if ! OUTPUT=$(pnpm lint 2>&1); then
            echo -e "${RED}  ✗ pnpm lint failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ pnpm lint passed${NC}"
        fi

        # Typecheck: Runs tsc --noEmit to verify types without generating JS
        # Catches type errors that might not appear in tests
        if ! OUTPUT=$(pnpm typecheck 2>&1); then
            echo -e "${RED}  ✗ pnpm typecheck failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ pnpm typecheck passed${NC}"
        fi

        # Tests via SKIP_TESTS env var (useful for CI without test env)
        if [ "${SKIP_TESTS:-false}" != "true" ]; then
            if ! OUTPUT=$(pnpm test 2>&1); then
                echo -e "${RED}  ✗ pnpm test failed${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                echo -e "${GREEN}  ✓ pnpm test passed${NC}"
            fi
        fi
    elif command -v npm &> /dev/null; then
        # Fallback to npm - runs same checks via "npm run <script>" syntax
        if ! OUTPUT=$(npm run lint 2>&1); then
            echo -e "${RED}  ✗ npm lint failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ npm lint passed${NC}"
        fi

        if ! OUTPUT=$(npm run typecheck 2>&1); then
            echo -e "${RED}  ✗ npm typecheck failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ npm typecheck passed${NC}"
        fi

        if [ "${SKIP_TESTS:-false}" != "true" ]; then
            if ! OUTPUT=$(npm test 2>&1); then
                echo -e "${RED}  ✗ npm test failed${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                echo -e "${GREEN}  ✓ npm test passed${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ pnpm/npm not installed - skipping TypeScript checks${NC}"
    fi
    echo ""
fi

# Python checks
# Uses ruff (modern, fast Python linter) and black (strict formatter)
# Falls back to warnings if tools not installed (Python dev tools are optional)
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " python " ]]; then
    echo -e "${BLUE}Running Python checks...${NC}"

    # ruff: Extremely fast Python linter written in Rust
    # Replaces flake8, pylint with unified, faster tool
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

    # black: The uncompromising Python code formatter
    # --check flag returns error code if files would be reformatted
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

    # pytest: Modern Python testing framework
    # -q (quiet) mode for cleaner output in CI
    if [ "${SKIP_TESTS:-false}" != "true" ]; then
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
# Uses shellcheck (static analysis for bash/sh) and BATS (Bash Automated Testing System)
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " shell " ]]; then
    echo -e "${BLUE}Running Shell script checks...${NC}"

    if command -v shellcheck &> /dev/null; then
        # Find all shell scripts excluding .git and build artifacts
        SHELL_SCRIPTS=$(find . -name "*.sh" -not -path "./.git/*" -not -path "./target/*" -not -path "./node_modules/*" 2>/dev/null || true)
        if [ -n "$SHELL_SCRIPTS" ]; then
            # Run shellcheck on each script individually
            sc_failed=0
            while IFS= read -r script; do
                [ -n "$script" ] || continue
                # Use --severity=error to only fail on actual errors, not style warnings
                # lint_if_changed handles hashing and caching
                if ! lint_if_changed "$script" "shellcheck" ".shellcheckrc" shellcheck --severity=error -f quiet "$script" 2>/dev/null; then
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

    # BATS tests: Run if tests/ directory exists and tests not skipped
    # NOTE: Skip if we're already inside a BATS test (prevent recursion)
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

# Markdown checks (if markdownlint is available)
# markdownlint enforces consistent Markdown style across the repo
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " markdown " ]]; then
    echo -e "${BLUE}Running Markdown checks...${NC}"

    if command -v markdownlint &> /dev/null; then
        # Check all .md files, ignoring dependencies and build artifacts
        MD_FILES=$(find . -name "*.md" -not -path "./node_modules/*" -not -path "./target/*" -not -path "./.git/*" 2>/dev/null || true)
        if [ -n "$MD_FILES" ]; then
            md_failed=0
            while IFS= read -r md_file; do
                [ -n "$md_file" ] || continue
                # lint_if_changed handles hashing and caching
                if ! OUTPUT=$(lint_if_changed "$md_file" "markdownlint" "markdownlint.toml" markdownlint "$md_file" 2>&1); then
                    echo -e "${RED}  ✗ markdownlint failed: $md_file${NC}"
                    echo "$OUTPUT" >&2
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

# --- Final result aggregation ---
# We use FAILED flag to accumulate errors across all checks
# Benefits of this pattern:
#   1. Users see ALL failures at once (not just the first)
#   2. Each check is independent - one failure doesn't skip others
#   3. Exit code 2 specifically indicates quality gate failure
#      (distinct from generic exit 1 which could be script error)
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
