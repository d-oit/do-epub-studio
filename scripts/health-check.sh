#!/usr/bin/env bash
# Health check for development environment.
# Verifies all required tools and dependencies are available.
# Exit 0 = all checks pass, Exit 2 = critical failures.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FAILED=0
WARNINGS=0

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  DO-EPUB-STUDIO Development Environment Health Check${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# --- Check: Node.js ---
echo -e "${BLUE}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "  ${GREEN}✓${NC} Node.js: $NODE_VERSION"

    # Check version requirement (Node 20+)
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -ge 20 ]; then
        echo -e "  ${GREEN}✓${NC} Node.js version OK (>= 20)"
    else
        echo -e "  ${RED}✗${NC} Node.js $NODE_VERSION is too old (require 20+)"
        FAILED=1
    fi
else
    echo -e "  ${RED}✗${NC} Node.js not found"
    FAILED=1
fi
echo ""

# --- Check: pnpm ---
echo -e "${BLUE}Checking package manager...${NC}"
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo -e "  ${GREEN}✓${NC} pnpm: $PNPM_VERSION"
else
    echo -e "  ${YELLOW}⚠${NC} pnpm not found (optional, will use npm)"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# --- Check: Git ---
echo -e "${BLUE}Checking Git...${NC}"
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo -e "  ${GREEN}✓${NC} Git: $GIT_VERSION"

    # Check git config
    if git config --get core.hooksPath &> /dev/null; then
        HOOKS_PATH=$(git config --get core.hooksPath)
        echo -e "  ${GREEN}✓${NC} Git hooks path: $HOOKS_PATH"
    else
        echo -e "  ${YELLOW}⚠${NC} No custom hooks path set"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "  ${RED}✗${NC} Git not found"
    FAILED=1
fi
echo ""

# --- Check: Required Files ---
echo -e "${BLUE}Checking project files...${NC}"

REQUIRED_FILES=(
    "package.json"
    "pnpm-workspace.yaml"
    "AGENTS.md"
    "eslint.config.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$REPO_ROOT/$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file missing"
        FAILED=1
    fi
done
echo ""

# --- Check: node_modules ---
echo -e "${BLUE}Checking dependencies...${NC}"
if [ -d "$REPO_ROOT/node_modules" ]; then
    echo -e "  ${GREEN}✓${NC} node_modules installed"

    # Check key dependencies
    KEY_DEPS=("vite" "typescript" "eslint" "vitest")
    for dep in "${KEY_DEPS[@]}"; do
        if [ -d "$REPO_ROOT/node_modules/$dep" ]; then
            echo -e "    ${GREEN}✓${NC} $dep"
        else
            echo -e "    ${RED}✗${NC} $dep missing"
            FAILED=1
        fi
    done
else
    echo -e "  ${RED}✗${NC} node_modules not installed"
    echo -e "  ${YELLOW}  Run: pnpm install${NC}"
    FAILED=1
fi
echo ""

# --- Check: Git Hooks ---
echo -e "${BLUE}Checking Git hooks...${NC}"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
if [ -d "$HOOKS_DIR" ]; then
    # Check for installed hooks
    INSTALLED_HOOKS=()
    for hook in pre-commit commit-msg pre-push; do
        if [ -f "$HOOKS_DIR/$hook" ]; then
            INSTALLED_HOOKS+=("$hook")
        fi
    done

    if [ ${#INSTALLED_HOOKS[@]} -gt 0 ]; then
        echo -e "  ${GREEN}✓${NC} Installed hooks: ${INSTALLED_HOOKS[*]}"
    else
        echo -e "  ${YELLOW}⚠${NC} No custom hooks installed"
        echo -e "  ${YELLOW}  Run: ./scripts/install-hooks.sh${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "  ${RED}✗${NC} .git/hooks directory not found"
    FAILED=1
fi
echo ""

# --- Check: Pre-commit ---
echo -e "${BLUE}Checking pre-commit config...${NC}"
if [ -f "$REPO_ROOT/.pre-commit-config.yaml" ]; then
    echo -e "  ${GREEN}✓${NC} .pre-commit-config.yaml exists"

    # Check if pre-commit is installed
    if command -v pre-commit &> /dev/null; then
        PC_VERSION=$(pre-commit --version 2>/dev/null || echo "unknown")
        echo -e "  ${GREEN}✓${NC} pre-commit: $PC_VERSION"

        # Check if hooks are installed
        if [ -f "$REPO_ROOT/.git/hooks/pre-commit" ]; then
            echo -e "  ${GREEN}✓${NC} pre-commit hook installed"
        else
            echo -e "  ${YELLOW}⚠${NC} pre-commit hooks not installed"
            echo -e "  ${YELLOW}  Run: pre-commit install${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        echo -e "  ${YELLOW}⚠${NC} pre-commit not installed"
        echo -e "  ${YELLOW}  Install: pip install pre-commit${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "  ${YELLOW}⚠${NC} .pre-commit-config.yaml not found"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# --- Check: ShellCheck (optional) ---
echo -e "${BLUE}Checking optional tools...${NC}"
OPTIONAL_TOOLS=("shellcheck" "markdownlint" "act")
for tool in "${OPTIONAL_TOOLS[@]}"; do
    if command -v "$tool" &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} $tool"
    else
        echo -e "  ${YELLOW}⚠${NC} $tool (optional)"
    fi
done
echo ""

# --- Check: Environment Files ---
echo -e "${BLUE}Checking environment files...${NC}"
if [ -f "$REPO_ROOT/.env.local" ]; then
    echo -e "  ${GREEN}✓${NC} .env.local exists"
elif [ -f "$REPO_ROOT/.dev.vars" ]; then
    echo -e "  ${GREEN}✓${NC} .dev.vars exists"
else
    echo -e "  ${YELLOW}⚠${NC} No .env.local or .dev.vars found"
    echo -e "  ${YELLOW}  Create one for local development${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# --- Check: Quality Gate Scripts ---
echo -e "${BLUE}Checking quality gate scripts...${NC}"
REQUIRED_SCRIPTS=(
    "scripts/quality_gate.sh"
    "scripts/validate-skills.sh"
    "scripts/validate-git-hooks.sh"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [ -f "$REPO_ROOT/$script" ]; then
        echo -e "  ${GREEN}✓${NC} $script"
    else
        echo -e "  ${RED}✗${NC} $script missing"
        FAILED=1
    fi
done
echo ""

# --- Summary ---
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $FAILED -ne 0 ]; then
    echo -e "${RED}✗ Health check FAILED ($FAILED critical issue(s))${NC}"
    echo ""
    echo "Please fix the issues above before continuing."
    exit 2
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ Health check PASSED with $WARNINGS warning(s)${NC}"
    echo ""
    echo "Warnings are non-blocking but recommended to address."
else
    echo -e "${GREEN}✓ Health check PASSED${NC}"
fi

echo ""
echo "Environment is ready for development!"
echo ""
echo "Quick commands:"
echo "  ./scripts/quality_gate.sh    # Full quality gate"
echo "  pnpm dev                     # Start dev server"
echo "  pnpm test                    # Run tests"
echo ""

exit 0
