#!/usr/bin/env bash
# Validates SKILL.md format: frontmatter, required fields, line count.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_SRC="$REPO_ROOT/.agents/skills"

# Colors
if [[ -t 1 ]] && [[ "${FORCE_COLOR:-}" != "0" ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    NC=''
fi

MAX_SKILL_LINES=${MAX_SKILL_LINES:-250}
ERRORS=0

echo "=== Validating SKILL.md Format ==="

if [ ! -d "$SKILLS_SRC" ]; then
    echo "No skills directory found."
    exit 0
fi

for skill_dir in "$SKILLS_SRC"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    [[ "$skill_name" == _* ]] && continue

    skill_file="${skill_dir}SKILL.md"
    if [ ! -f "$skill_file" ]; then
        continue
    fi

    local_errors=0

    # Check 1: Must start with frontmatter
    first_line=$(head -n 1 "$skill_file")
    if [[ "$first_line" != "---" ]]; then
        echo -e "  ${RED}[FAIL]${NC} $skill_name: SKILL.md must start with ---"
        local_errors=$((local_errors + 1))
    fi

    # Check 2: Must have name field
    if ! grep -q "^name:" "$skill_file" 2>/dev/null; then
        echo -e "  ${RED}[FAIL]${NC} $skill_name: Missing 'name:' in frontmatter"
        local_errors=$((local_errors + 1))
    fi

    # Check 3: Must have description field
    if ! grep -q "^description:" "$skill_file" 2>/dev/null; then
        echo -e "  ${RED}[FAIL]${NC} $skill_name: Missing 'description:' in frontmatter"
        local_errors=$((local_errors + 1))
    fi

    # Check 4: Line count
    lines=$(wc -l < "$skill_file" | tr -d ' ')
    if [ "$lines" -gt "$MAX_SKILL_LINES" ]; then
        echo -e "  ${RED}[FAIL]${NC} $skill_name: $lines lines (max $MAX_SKILL_LINES)"
        local_errors=$((local_errors + 1))
    fi

    if [ $local_errors -eq 0 ]; then
        echo -e "  ${GREEN}[OK]${NC} $skill_name: Valid ($lines lines)"
    fi

    ERRORS=$((ERRORS + local_errors))
done

echo ""
if [[ $ERRORS -eq 0 ]]; then
    echo "All SKILL.md files passed validation"
    exit 0
else
    echo "Found $ERRORS skill(s) with errors"
    exit 1
fi
