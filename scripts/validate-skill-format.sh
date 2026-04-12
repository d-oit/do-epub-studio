#!/usr/bin/env bash
# Validates SKILL.md format per agentskills.io specification.
# Checks: frontmatter syntax, required fields, constraints, naming, line count.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

SKILLS_SRC="$REPO_ROOT/.agents/skills"

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
        printf '%s[FAIL]%s %s: SKILL.md must start with ---\n' "${RED}" "${NC}" "$skill_name"
        local_errors=$((local_errors + 1))
    fi

    # Check 2: name field required
    if ! grep -q "^name:" "$skill_file" 2>/dev/null; then
        printf '%s[FAIL]%s %s: Missing name in frontmatter\n' "${RED}" "${NC}" "$skill_name"
        local_errors=$((local_errors + 1))
    else
        # Validate name constraints
        raw_name=$(grep -m1 "^name:" "$skill_file" | sed 's/^name:[[:space:]]*//; s/^"//; s/"$//' | tr -d "'")
        if [ "$raw_name" != "$skill_name" ]; then
            printf '%s[FAIL]%s %s: name=%s does not match directory\n' "${RED}" "${NC}" "$skill_name" "'$raw_name'"
            local_errors=$((local_errors + 1))
        fi
        if [ ${#raw_name} -gt 64 ]; then
            printf '%s[FAIL]%s %s: name exceeds 64 chars (%d)\n' "${RED}" "${NC}" "$skill_name" "${#raw_name}"
            local_errors=$((local_errors + 1))
        fi
        if ! echo "$raw_name" | grep -qE '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'; then
            printf '%s[FAIL]%s %s: name must be lowercase alphanumeric + hyphens\n' "${RED}" "${NC}" "$skill_name"
            local_errors=$((local_errors + 1))
        fi
        if echo "$raw_name" | grep -q -- '--'; then
            printf '%s[FAIL]%s %s: name has consecutive hyphens\n' "${RED}" "${NC}" "$skill_name"
            local_errors=$((local_errors + 1))
        fi
    fi

    # Check 3: description field required
    if ! grep -q "^description:" "$skill_file" 2>/dev/null; then
        printf '%s[FAIL]%s %s: Missing description in frontmatter\n' "${RED}" "${NC}" "$skill_name"
        local_errors=$((local_errors + 1))
    fi

    # Check 4: category field required
    if ! grep -q "^category:" "$skill_file" 2>/dev/null; then
        printf '%s[FAIL]%s %s: Missing category field\n' "${RED}" "${NC}" "$skill_name"
        local_errors=$((local_errors + 1))
    else
        raw_cat=$(grep -m1 "^category:" "$skill_file" | sed 's/^category:[[:space:]]*//')
        case "$raw_cat" in
            coordination|quality|documentation|workflow|research|knowledge-management) ;;
            *)
                printf '%s[FAIL]%s %s: invalid category=%s\n' "${RED}" "${NC}" "$skill_name" "'$raw_cat'"
                local_errors=$((local_errors + 1))
                ;;
        esac
    fi

    # Check 5: allowed-tools field required
    if ! grep -q "^allowed-tools:" "$skill_file" 2>/dev/null; then
        printf '%s[FAIL]%s %s: Missing allowed-tools field\n' "${RED}" "${NC}" "$skill_name"
        local_errors=$((local_errors + 1))
    fi

    # Check 6: No duplicate version fields
    ver_count=$(grep -c "^version:" "$skill_file" 2>/dev/null || true)
    if [ "$ver_count" -gt 1 ]; then
        printf '%s[FAIL]%s %s: duplicate version field (%d occurrences)\n' "${RED}" "${NC}" "$skill_name" "$ver_count"
        local_errors=$((local_errors + 1))
    fi

    # Check 7: Line count
    lines=$(wc -l < "$skill_file" | tr -d ' ')
    if [ "$lines" -gt "$MAX_SKILL_LINES" ]; then
        printf '%s[FAIL]%s %s: %d lines (max %d)\n' "${RED}" "${NC}" "$skill_name" "$lines" "$MAX_SKILL_LINES"
        local_errors=$((local_errors + 1))
    fi

    if [ $local_errors -eq 0 ]; then
        printf '%s[OK]%s %s: Valid (%d lines)\n' "${GREEN}" "${NC}" "$skill_name" "$lines"
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
