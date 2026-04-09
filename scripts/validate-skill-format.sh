#!/usr/bin/env bash
# Validates SKILL.md format per agentskills.io specification.
# Checks: frontmatter syntax, required fields, constraints, naming, line count.
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

echo "=== Validating SKILL.md Format (agentskills.io spec) ==="

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

    # Check 1: Must start with frontmatter delimiter
    first_line=$(head -n 1 "$skill_file")
    if [[ "$first_line" != "---" ]]; then
        echo -e "  ${RED}[FAIL]${NC} $skill_name: SKILL.md must start with ---"
        local_errors=$((local_errors + 1))
    fi

    # Check 2: name field required
    if ! grep -q "^name:" "$skill_file" 2>/dev/null; then
        echo -e "  ${RED}[FAIL]${NC} $skill_name: Missing 'name:' in frontmatter"
        local_errors=$((local_errors + 1))
    else
        # Validate name constraints: kebab-case, max 64 chars, matches directory
        raw_name=$(grep -m1 "^name:" "$skill_file" | sed 's/^name:[[:space:]]*//; s/^"//; s/"$//' | tr -d "'")
        if [ "$raw_name" != "$skill_name" ]; then
            echo -e "  ${RED}[FAIL]${NC} $skill_name: name='$raw_name' doesn't match directory"
            local_errors=$((local_errors + 1))
        fi
        if [ ${#raw_name} -gt 64 ]; then
            echo -e "  ${RED}[FAIL]${NC} $skill_name: name exceeds 64 chars (${#raw_name})"
            local_errors=$((local_errors + 1))
        fi
        if ! echo "$raw_name" | grep -qE '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'; then
            echo -e "  ${RED}[FAIL]${NC} $skill_name: name must be lowercase alphanumeric + hyphens, no start/end hyphens"
            local_errors=$((local_errors + 1))
        fi
        if echo "$raw_name" | grep -q -- '--'; then
            echo -e "  ${RED}[FAIL]${NC} $skill_name: name has consecutive hyphens"
            local_errors=$((local_errors + 1))
        fi
    fi

    # Check 3: description field required, max 1024 chars
    if ! grep -q "^description:" "$skill_file" 2>/dev/null; then
        echo -e "  ${RED}[FAIL]${NC} $skill_name: Missing 'description:' in frontmatter"
        local_errors=$((local_errors + 1))
    fi

    # Check 4: category field required (project extension)
    if ! grep -q "^category:" "$skill_file" 2>/dev/null; then
        echo -e "  ${RED}[FAIL]${NC} $skill_name: Missing 'category:' field (coordination|quality|documentation|workflow|research|knowledge-management)"
        local_errors=$((local_errors + 1))
    else
        raw_cat=$(grep -m1 "^category:" "$skill_file" | sed 's/^category:[[:space:]]*//')
        case "$raw_cat" in
            coordination|quality|documentation|workflow|research|knowledge-management) ;;
            *)
                echo -e "  ${RED}[FAIL]${NC} $skill_name: invalid category='$raw_cat'"
                local_errors=$((local_errors + 1))
                ;;
        esac
    fi

    # Check 5: allowed-tools field required (project security rule)
    if ! grep -q "^allowed-tools:" "$skill_file" 2>/dev/null; then
        echo -e "  ${RED}[FAIL]${NC} $skill_name: Missing 'allowed-tools:' field"
        local_errors=$((local_errors + 1))
    fi

    # Check 6: No duplicate version fields
    ver_count=$(grep -c "^version:" "$skill_file" 2>/dev/null || true)
    if [ "$ver_count" -gt 1 ]; then
        echo -e "  ${RED}[FAIL]${NC} $skill_name: duplicate version field ($ver_count occurrences)"
        local_errors=$((local_errors + 1))
    fi

    # Check 7: Line count
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
