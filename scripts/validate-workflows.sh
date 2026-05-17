#!/usr/bin/env bash
# Validate GitHub Actions workflow syntax.
# Checks YAML validity, SHA pinning, and allowed versions.
# Exit 0 = valid, Exit 2 = errors found.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"
# shellcheck source=scripts/validate-shas.sh
source "$REPO_ROOT/scripts/validate-shas.sh"

FAILED=0

# Find all workflow files
mapfile -t WORKFLOW_FILES < <(find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null || true)

if [ ${#WORKFLOW_FILES[@]} -eq 0 ]; then
    printf '%sOK No workflow files found - skipping validation%s\n' "${GREEN}" "${NC}"
    exit 0
fi

printf '%sValidating %d workflow file(s)...%s\n' "${BLUE}" "${#WORKFLOW_FILES[@]}" "${NC}"

# Check for YAML validator
YAML_VALIDATOR=""
if command -v yamllint &> /dev/null; then
    YAML_VALIDATOR="yamllint"
elif command -v node &> /dev/null && node -e "require('js-yaml')" &> /dev/null; then
    YAML_VALIDATOR="node-js-yaml"
elif command -v python3 &> /dev/null && python3 -c "import yaml" &> /dev/null; then
    YAML_VALIDATOR="python3"
fi

for file in "${WORKFLOW_FILES[@]}"; do
    printf '%sChecking: %s%s\n' "${BLUE}" "$file" "${NC}"
    FILE_FAILED=0

    # 1. Check YAML syntax
    if [ "$YAML_VALIDATOR" == "yamllint" ]; then
        if ! yamllint -d "{extends: default, rules: {line-length: disable, document-start: disable}}" "$file"; then
            printf '%s  FAIL YAML syntax errors (yamllint): %s%s\n' "${RED}" "$file" "${NC}"
            FILE_FAILED=1
        fi
    elif [ "$YAML_VALIDATOR" == "node-js-yaml" ]; then
        if ! node -e "const yaml = require('js-yaml'); const fs = require('fs'); try { yaml.load(fs.readFileSync('$file', 'utf8')); } catch (e) { console.error(e.message); process.exit(1); }" ; then
            printf '%s  FAIL Invalid YAML syntax (js-yaml): %s%s\n' "${RED}" "$file" "${NC}"
            FILE_FAILED=1
        fi
    elif [ "$YAML_VALIDATOR" == "python3" ]; then
        if ! python3 -c "import yaml; yaml.safe_load(open(\"$file\"))" 2>/dev/null; then
            printf '%s  FAIL Invalid YAML syntax (PyYAML): %s%s\n' "${RED}" "$file" "${NC}"
            FILE_FAILED=1
        fi
    else
        printf '%s  WARN No YAML validator found (skipping syntax check)%s\n' "${YELLOW}" "${NC}"
    fi

    # 2. Check for required top-level keys
    if ! grep -q "^on:" "$file" && ! grep -q "^on:$" "$file"; then
        printf '%s  FAIL Missing "on:" trigger%s\n' "${RED}" "${NC}"
        FILE_FAILED=1
    fi

    if ! grep -q "^jobs:" "$file"; then
        printf '%s  FAIL Missing "jobs:" key%s\n' "${RED}" "${NC}"
        FILE_FAILED=1
    fi

    # 3. Check for potentially missing permissions
    if ! grep -q "permissions:" "$file"; then
        printf '%s  WARN Missing explicit permissions (non-blocking)%s\n' "${YELLOW}" "${NC}"
    fi

    # 4. Check for SHA pinning and allowed versions
    while IFS=: read -r line_num line; do
        # Extract the 'uses:' value
        uses_val=$(echo "$line" | sed -n 's/.*uses:\s*\(.*\)/\1/p' | sed 's/\s*#.*//' | xargs)

        # Skip local actions
        if [[ "$uses_val" == ./* ]] || [[ "$uses_val" == "./"* ]]; then
            continue
        fi

        # Check if it has a SHA (40 hex chars)
        if [[ ! "$uses_val" =~ @[a-f0-9]{40} ]]; then
            printf '%s  FAIL Action not pinned to SHA at line %s: %s%s\n' "${RED}" "$line_num" "$uses_val" "${NC}"
            FILE_FAILED=1
        else
            # Check if SHA is allowed
            action_with_sha=$(echo "$uses_val" | cut -d' ' -f1)
            if ! is_allowed_sha "$action_with_sha"; then
                printf '%s  FAIL Disallowed or unverified SHA at line %s: %s%s\n' "${RED}" "$line_num" "$action_with_sha" "${NC}"
                FILE_FAILED=1
            fi
        fi
    done < <(grep -nE "^[[:space:]]*-?[[:space:]]*uses:" "$file" || true)

    if [ $FILE_FAILED -eq 0 ]; then
        printf '%s  OK %s passed validation%s\n' "${GREEN}" "$file" "${NC}"
    else
        FAILED=1
    fi
done

echo ""

if [ $FAILED -ne 0 ]; then
    printf '%sFAIL Workflow validation FAILED%s\n' "${RED}" "${NC}"
    exit 2
fi

printf '%sOK All %d workflow(s) validated successfully%s\n' "${GREEN}" "${#WORKFLOW_FILES[@]}" "${NC}"
exit 0
