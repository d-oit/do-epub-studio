#!/usr/bin/env bash
# Git pre-commit hook (standalone).
# Install: cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
# Or run: ./scripts/install-hooks.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

echo -e "${BLUE}Running pre-commit checks...${NC}"

# Run the quality gate (runs on the full repo, not just staged)
if ! "$REPO_ROOT/scripts/quality_gate.sh"; then
    echo ""
    echo -e "${RED}✗ Pre-commit checks failed${NC}"
    echo "Fix the errors above before committing."
    exit 1
fi

echo -e "${GREEN}✓ Pre-commit checks passed${NC}"
