#!/usr/bin/env bash
# Install local git hooks by copying them to .git/hooks/
# Run once after cloning: ./scripts/install-hooks.sh
# The hooks are also tracked in .git/hooks/ for direct use.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"

# Create .git/hooks if it doesn't exist (handles fresh clones)
mkdir -p "$HOOKS_DIR"

# Source colors
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

HOOKS=(
    "pre-commit"
    "commit-msg"
    "pre-push"
)

INSTALLED=0
SKIPPED=0

for hook in "${HOOKS[@]}"; do
    src="$REPO_ROOT/scripts/hooks/$hook"
    dst="$HOOKS_DIR/$hook"

    if [[ ! -f "$src" ]]; then
        echo -e "${YELLOW}⚠${NC} Hook source not found: $src"
        continue
    fi

    # Check if hook already exists and is identical
    if [[ -f "$dst" ]] && diff -q "$src" "$dst" &>/dev/null; then
        echo -e "${GREEN}✓${NC} $hook (up to date)"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    cp "$src" "$dst"
    chmod +x "$dst"
    echo -e "${GREEN}✓${NC} $hook (installed)"
    INSTALLED=$((INSTALLED + 1))
done

echo ""
echo "Installed: $INSTALLED | Skipped (up to date): $SKIPPED"
echo ""
echo "To verify: ls -la .git/hooks/"
