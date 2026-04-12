#!/usr/bin/env bash
# Validates all CLI skill symlinks.
# Used in pre-commit hook and CI. Exit 2 on failure (surfaced to agent).
# Note: Format validation is handled by validate-skill-format.sh separately.
# NOTE: errexit disabled explicitly - it causes unpredictable failures in CI
set +e
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

SKILLS_SRC="$REPO_ROOT/.agents/skills"

CLI_SKILL_DIRS=(
  ".claude/skills"
  ".gemini/skills"
)

FAILED=0

echo "Validating skills..."
echo ""

# If no skills exist, nothing to validate
if [ ! -d "$SKILLS_SRC" ] || [ -z "$(ls -A "$SKILLS_SRC" 2>/dev/null)" ]; then
    echo "No skills in .agents/skills/ - nothing to validate."
    exit 0
fi

# --- Validate canonical skills in .agents/skills/ ---
echo "Checking canonical skills in .agents/skills/..."

for skill_path in "$SKILLS_SRC"/*/; do
    [ -d "$skill_path" ] || continue
    skill_name="$(basename "$skill_path")"

    # Skip consolidated/backup folders
    if [[ "$skill_name" == _* ]]; then
        continue
    fi

    # Check 1: SKILL.md must exist
    if [ ! -f "$skill_path/SKILL.md" ]; then
        echo -e "${RED}✗${NC} $skill_name: Missing SKILL.md" >&2
        FAILED=1
        continue
    fi

    # Check 2: Circular symlink detection
    if [ -L "$skill_path" ]; then
        echo -e "${RED}✗${NC} $skill_name: Circular symlink detected" >&2
        FAILED=1
    fi

    # Check 3: Symlinks in CLI dirs (not .qwen — reads directly)
    for cli_dir in "${CLI_SKILL_DIRS[@]}"; do
        link="$REPO_ROOT/$cli_dir/$skill_name"

        if [ ! -L "$link" ]; then
            echo -e "${RED}✗${NC} MISSING symlink: $cli_dir/$skill_name" >&2
            FAILED=1
        elif [ ! -d "$link" ]; then
            echo -e "${RED}✗${NC} BROKEN symlink: $cli_dir/$skill_name -> $(readlink "$link")" >&2
            FAILED=1
        fi
    done
done

echo ""

# --- Summary ---
if [ $FAILED -ne 0 ]; then
    echo -e "${RED}─────────────────────────────────────────────────────────────────${NC}" >&2
    echo -e "${RED}│ ✗ Skill Validation FAILED                                     │${NC}" >&2
    echo -e "${RED}─────────────────────────────────────────────────────────────────${NC}" >&2
    echo "" >&2
    echo "Run: ./scripts/setup-skills.sh to fix missing symlinks." >&2
    echo "See: agents-docs/SKILLS.md for skill authoring guide." >&2
    exit 2
fi

echo -e "${GREEN}─────────────────────────────────────────────────────────────────${NC}"
echo -e "${GREEN}│ ✓ All skill validations passed                                │${NC}"
echo -e "${GREEN}─────────────────────────────────────────────────────────────────${NC}"
