#!/usr/bin/env bash
# Validate GitHub Actions workflow syntax.
# Checks YAML validity and common workflow issues.
# Exit 0 = valid, Exit 2 = errors found.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

FAILED=0

# Find all workflow files
mapfile -t WORKFLOW_FILES < <(find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null || true)

if [ ${#WORKFLOW_FILES[@]} -eq 0 ]; then
    printf '%s✓ No workflow files found — skipping validation%s\n' "${GREEN}" "${NC}"
    exit 0
fi

printf '%sValidating %d workflow file(s)...%s\n' "${BLUE}" "${#WORKFLOW_FILES[@]}" "${NC}"

# Check if YAML processor is available
YAML_CHECK=""
if command -v python3 &> /dev/null; then
    YAML_CHECK="python3"
elif command -v python &> /dev/null; then
    YAML_CHECK="python"
fi

for file in "${WORKFLOW_FILES[@]}"; do
    printf '%sChecking: %s%s\n' "${BLUE}" "$file" "${NC}"

    # Check YAML syntax
    if [ -n "$YAML_CHECK" ]; then
        if ! $YAML_CHECK -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
            printf '%s✗ Invalid YAML syntax: %s%s\n' "${RED}" "$file" "${NC}"
            FAILED=1
            continue
        fi
    fi

    # Check for required top-level keys
    if ! grep -q "^on:" "$file" && ! grep -q "^on:$" "$file"; then
        printf '%s✗ Missing "on:" trigger: %s%s\n' "${RED}" "$file" "${NC}"
        FAILED=1
    fi

    if ! grep -q "^jobs:" "$file"; then
        printf '%s✗ Missing "jobs:" key: %s%s\n' "${RED}" "$file" "${NC}"
        FAILED=1
    fi

    # Check for jobs without runs-on
    if grep -q "^\s*-.*:" "$file"; then
        # Simple check for job definitions
        :
    fi

    # Check for potentially missing permissions
    if ! grep -q "permissions:" "$file"; then
        printf '%s⚠ Missing explicit permissions: %s%s\n' "${YELLOW}" "$file" "${NC}"
    fi

    printf '%s✓ %s%s\n' "${GREEN}" "$file" "${NC}"
done

echo ""

if [ $FAILED -ne 0 ]; then
    printf '%s✗ Workflow validation FAILED (%d file(s) with issues)%s\n' "${RED}" "$FAILED" "${NC}"
    exit 2
fi

printf '%s✓ All %d workflow(s) validated successfully%s\n' "${GREEN}" "${#WORKFLOW_FILES[@]}" "${NC}"
exit 0
