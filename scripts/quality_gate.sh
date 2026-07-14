#!/usr/bin/env bash
# Full quality gate with auto-detection for multiple languages.
# Exit 0 = success (all required phases ran and passed)
# Exit 2 = errors surfaced to agent
# Used in pre-commit hook and CI.
#
# SKIP_* env vars (SKIP_LINT, SKIP_TYPECHECK, etc.) are for local dev convenience
# only. When any SKIP_* is set, the gate exits with a warning code (exit 3) to
# indicate that not all required phases were executed. CI must NEVER set these.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

# FAILED acts as an error accumulator
FAILED=0

# SKIPPED tracks whether any required phase was skipped via SKIP_* env vars
SKIPPED=0

# DETECTED_LANGUAGES stores which language ecosystems are present
DETECTED_LANGUAGES=()

echo "Running quality gate..."
echo ""

# --- Validate git hooks configuration (always run) ---
printf '%sValidating git hooks configuration...%s\n' "${BLUE}" "${NC}"
if ! "$REPO_ROOT/scripts/validate-git-hooks.sh" 2>&1; then
    printf '%s⚠ Git hooks config warning (non-blocking)%s\n' "${YELLOW}" "${NC}"
    FAILED=1
fi
echo ""

# --- Validate GitHub Actions workflows (actionlint + zizmor, no env gate) ---
# Per ADR-112 (CI hardening): zizmor is part of the default gate. Workflows
# are scanned for medium+ severity security findings.
printf '%sValidating GitHub Actions workflows...%s\n' "${BLUE}" "${NC}"
if ! "$REPO_ROOT/scripts/validate-workflows.sh"; then
    FAILED=1
fi
echo ""

# --- Validate skill symlinks ---
printf '%sValidating skill symlinks...%s\n' "${BLUE}" "${NC}"
if ! "$REPO_ROOT/scripts/validate-skills.sh"; then
    FAILED=1
fi
echo ""

# --- Validate per-model agent adapter drift ---
printf '%sValidating per-model agent adapters...%s\n' "${BLUE}" "${NC}"
if [ -f "$REPO_ROOT/scripts/check-agent-sync.mjs" ]; then
    if ! node "$REPO_ROOT/scripts/check-agent-sync.mjs"; then
        FAILED=1
    fi
fi
echo ""

# --- Validate app identity and version governance (ADR-104) ---
printf '%sValidating app identity and version governance...%s\n' "${BLUE}" "${NC}"
if [ -f "$REPO_ROOT/scripts/check-app-identity.mjs" ]; then
    if ! node "$REPO_ROOT/scripts/check-app-identity.mjs"; then
        FAILED=1
    fi
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
    echo -e "  ${GREEN}✓${NC} TypeScript/JavaScript (package.json)"
    DETECTED_LANGUAGES+=("typescript")
fi

# Python detection
if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
    echo -e "  ${GREEN}✓${NC} Python (requirements.txt/pyproject.toml)"
    DETECTED_LANGUAGES+=("python")
fi

# Rust detection (detected but not yet supported)
if [ -f "Cargo.toml" ]; then
    echo -e "  ${YELLOW}⊘${NC} Rust detected (Cargo.toml) — not yet supported by quality gate"
    DETECTED_LANGUAGES+=("rust")
fi

# Go detection (detected but not yet supported)
if [ -f "go.mod" ]; then
    echo -e "  ${YELLOW}⊘${NC} Go detected (go.mod) — not yet supported by quality gate"
    DETECTED_LANGUAGES+=("go")
fi

# Shell script detection via file existence
if find . -name "*.sh" -not -path "./.git/*" | grep -q .; then
    echo -e "  ${GREEN}✓${NC} Shell scripts detected"
    DETECTED_LANGUAGES+=("shell")
fi

# Markdown detection via file existence
if find . -name "*.md" -not -path "./.git/*" | grep -q .; then
    echo -e "  ${GREEN}✓${NC} Markdown files detected"
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

        # Lint (respect SKIP_LINT env var)
        if [ "${SKIP_LINT:-false}" != "true" ]; then
            if ! OUTPUT=$($RUN lint 2>&1); then
                printf '%s  ✗ %s lint failed%s\n' "${RED}" "$PM" "${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                printf '%s  ✓ %s lint passed%s\n' "${GREEN}" "$PM" "${NC}"
            fi
        else
            printf '%s  ⊘ %s lint skipped (SKIP_LINT=true)%s\n' "${YELLOW}" "$PM" "${NC}"
            SKIPPED=1
        fi

        # Typecheck (respect SKIP_TYPECHECK env var)
        if [ "${SKIP_TYPECHECK:-false}" != "true" ]; then
            if ! OUTPUT=$($RUN typecheck 2>&1); then
                printf '%s  ✗ %s typecheck failed%s\n' "${RED}" "$PM" "${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                printf '%s  ✓ %s typecheck passed%s\n' "${GREEN}" "$PM" "${NC}"
            fi
        else
            printf '%s  ⊘ %s typecheck skipped (SKIP_TYPECHECK=true)%s\n' "${YELLOW}" "$PM" "${NC}"
            SKIPPED=1
        fi

        # Tests (respect SKIP_TESTS env var for local dev without node_modules)
        if [ "${SKIP_TESTS:-false}" != "true" ]; then
            # Use test:coverage for stricter verification
            if ! OUTPUT=$($PM run test:coverage 2>&1); then
                printf '%s  ✗ %s test:coverage failed%s\n' "${RED}" "$PM" "${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                printf '%s  ✓ %s test:coverage passed%s\n' "${GREEN}" "$PM" "${NC}"
            fi

            # Build (skip with SKIP_BUILD env var)
            if [ "${SKIP_BUILD:-false}" != "true" ]; then
                if ! OUTPUT=$($PM run build 2>&1); then
                    printf '%s  ✗ %s build failed%s\n' "${RED}" "$PM" "${NC}"
                    echo "$OUTPUT" >&2
                    FAILED=1
                else
                    printf '%s  ✓ %s build passed%s\n' "${GREEN}" "$PM" "${NC}"
                fi
            else
                printf '%s  ⊘ %s build skipped (SKIP_BUILD=true)%s\n' "${YELLOW}" "$PM" "${NC}"
                SKIPPED=1
            fi

            # Smoke tests (skip with SKIP_SMOKE env var)
            if [ "${SKIP_SMOKE:-false}" != "true" ]; then
                # Ensure Playwright browsers are installed (chromium + firefox + webkit required)
                MISSING_BROWSERS=""
                if ! ls ~/.cache/ms-playwright/chromium-*/chrome-linux/chrome >/dev/null 2>&1; then
                    MISSING_BROWSERS="chromium $MISSING_BROWSERS"
                fi
                if ! ls ~/.cache/ms-playwright/firefox-*/firefox/firefox >/dev/null 2>&1; then
                    MISSING_BROWSERS="firefox $MISSING_BROWSERS"
                fi
                if ! ls ~/.cache/ms-playwright/webkit-*/pw_run.sh >/dev/null 2>&1; then
                    MISSING_BROWSERS="webkit $MISSING_BROWSERS"
                fi
                if [ -n "$MISSING_BROWSERS" ]; then
                    printf '%s  ⟳ Installing Playwright browsers (%s)...%s\n' "${YELLOW}" "$MISSING_BROWSERS" "${NC}"
                    if ! OUTPUT=$(npx playwright install $MISSING_BROWSERS 2>&1); then
                        printf '%s  ✗ Playwright browser installation failed%s\n' "${RED}" "${NC}"
                        echo "$OUTPUT" >&2
                        FAILED=1
                    else
                        printf '%s  ✓ Playwright browsers installed%s\n' "${GREEN}" "${NC}"
                    fi
                fi

                if [ $FAILED -eq 0 ]; then
                    if ! OUTPUT=$($PM run test:e2e:smoke 2>&1); then
                        printf '%s  ✗ %s test:e2e:smoke failed%s\n' "${RED}" "$PM" "${NC}"
                        echo "$OUTPUT" >&2
                        FAILED=1
                    else
                        printf '%s  ✓ %s test:e2e:smoke passed%s\n' "${GREEN}" "$PM" "${NC}"
                    fi
                fi
            else
                printf '%s  ⊘ %s smoke tests skipped (SKIP_SMOKE=true)%s\n' "${YELLOW}" "$PM" "${NC}"
                SKIPPED=1
            fi
        else
            printf '%s  ⊘ %s tests skipped (SKIP_TESTS=true)%s\n' "${YELLOW}" "$PM" "${NC}"
            SKIPPED=1
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

    # BATS tests — always run if tests/ directory exists
    if [ -d "tests" ] && [ -z "${BATS_TEST_FILENAME:-}" ]; then
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

# Markdown checks (markdownlint, runs by default when installed — no env gate)
# Per ADR-112: markdownlint is part of the default quality gate.
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " markdown " ]]; then
    printf '%sRunning Markdown checks...%s\n' "${BLUE}" "${NC}"

    if command -v markdownlint &> /dev/null; then
        MD_FILES=$(find . \
            -path "./node_modules" -prune -o \
            -path "./.opencode/node_modules" -prune -o \
            -path "./target" -prune -o \
            -path "./.git" -prune -o \
            -name "*.md" -print 2>/dev/null || true)
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

# --- Impeccable design detector (UI quality gate) ---
# Per ADR-111 §2: findings are JSON-summary and `::warning::` by default.
# Promote to required via IMPECCABLE_REQUIRED=1 ./scripts/quality_gate.sh.
# The wrapper script exits 0 unless IMPECCABLE_REQUIRED=1 and findings > 0,
# so this step never blocks the gate on findings alone.
if [ "${SKIP_DESIGN:-0}" != "1" ]; then
    printf '%sRunning Impeccable design detector...%s\n' "${BLUE}" "${NC}"
    if [ -f "$REPO_ROOT/scripts/run-impeccable.sh" ]; then
        if ! IMPECCABLE_REQUIRED="${IMPECCABLE_REQUIRED:-0}" "$REPO_ROOT/scripts/run-impeccable.sh" 2>&1; then
            FAILED=1
        fi
    else
        printf '%s  ⊘ scripts/run-impeccable.sh not found — skipping%s\n' "${YELLOW}" "${NC}"
    fi
    echo ""
else
    SKIPPED=1
fi

# --- Final result ---
if [ $FAILED -ne 0 ]; then
    printf '%s─────────────────────────────────────────────────────────────────%s\n' "${RED}" "${NC}"
    printf '%s│ ✗ Quality Gate FAILED                                         │%s\n' "${RED}" "${NC}"
    printf '%s─────────────────────────────────────────────────────────────────%s\n' "${RED}" "${NC}"
    echo ""
    echo "Fix the errors above and re-run quality gate."
    exit 2
fi

if [ $SKIPPED -ne 0 ]; then
    printf '%s─────────────────────────────────────────────────────────────────%s\n' "${YELLOW}" "${NC}"
    printf '%s│ ⚠ Quality Gate PASSED with skipped phases                    │%s\n' "${YELLOW}" "${NC}"
    printf '%s─────────────────────────────────────────────────────────────────%s\n' "${YELLOW}" "${NC}"
    echo ""
    echo "Some phases were skipped via SKIP_* env vars."
    echo "Run without SKIP_* for the full gate: ./scripts/quality_gate.sh"
    exit 3
fi

printf '%s─────────────────────────────────────────────────────────────────%s\n' "${GREEN}" "${NC}"
printf '%s│ ✓ All Quality Gates PASSED                                    │%s\n' "${GREEN}" "${NC}"
printf '%s─────────────────────────────────────────────────────────────────%s\n' "${GREEN}" "${NC}"
echo ""
echo "Languages checked: ${DETECTED_LANGUAGES[*]}"
