#!/usr/bin/env bash
# Validate that GitHub Actions SHAs in workflows are valid commit SHAs.
# Detects placeholder patterns without requiring gh CLI.
# Exits 0 if all SHAs are valid, 1 if any are invalid/placeholder.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Source shared libs
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

FAILED=0
CHECKED=0

# Find all workflow files
mapfile -t WORKFLOW_FILES < <(find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null || true)

if [ ${#WORKFLOW_FILES[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ No workflow files found — skipping SHA validation${NC}"
    exit 0
fi

echo -e "${BLUE}Checking ${#WORKFLOW_FILES[@]} workflow file(s)...${NC}"

# Placeholder SHA patterns to detect:
# 1. All same character (e.g., aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa)
# 2. Common fake patterns: deadbeef, abcdef1234567890, 00000000
# 3. Repeating short sequences
PLACEHOLDER_PATTERNS=(
    '^(.)\1{39}$'                              # All same char
    '^deadbeef'                                # Classic dev placeholder
    '^abcdef1234567890abcdef1234567890abcdef12'  # Sequential hex pattern
    '^0{40}$'                                  # All zeros
    '^1{40}$'                                  # All ones
    '^f{40}$'                                  # All f's
)

for file in "${WORKFLOW_FILES[@]}"; do
    while IFS=: read -r line_num line; do
        action_sha=$(echo "$line" | sed -n 's/.*uses:\s*[^@]*@\([a-f0-9]\{40\}\).*/\1/p')
        if [ -n "$action_sha" ]; then
            CHECKED=$((CHECKED + 1))
            is_placeholder=false

            for pattern in "${PLACEHOLDER_PATTERNS[@]}"; do
                if echo "$action_sha" | grep -qE "$pattern"; then
                    echo -e "${RED}✗ Placeholder SHA in $file:$line_num: $action_sha${NC}"
                    is_placeholder=true
                    FAILED=1
                    break
                fi
            done

            if [[ "$is_placeholder" == false ]]; then
                echo -e "${GREEN}✓ $file:$line_num — SHA looks valid${NC}"
            fi
        fi
    done < <(grep -n "uses:" "$file" | grep "@[a-f0-9]\{40\}" || true)
done

echo ""
if [ $CHECKED -eq 0 ]; then
    echo -e "${GREEN}✓ No pinned SHAs found — consider pinning actions for supply-chain security${NC}"
elif [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All $CHECKED SHA(s) appear valid${NC}"
else
    echo -e "${RED}✗ Found placeholder SHAs ($CHECKED checked, $FAILED invalid)${NC}"
fi

exit $FAILED
