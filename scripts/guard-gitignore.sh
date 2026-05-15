#!/usr/bin/env bash
# Guard: Prevent deletion of .gitignore files
# Called by quality_gate.sh before commits
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Source colors
# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

VIOLATIONS=0

# Check staged changes for .gitignore deletions
while IFS= read -r line; do
  if echo "$line" | grep -qP '^D\s.*\.gitignore'; then
    file=$(echo "$line" | awk '{print $2}')
    echo -e "${RED}✗ BLOCKED: Deletion of .gitignore: $file${NC}"
    echo -e "${YELLOW}  .gitignore files control what enters the repository.${NC}"
    echo -e "${YELLOW}  Never delete them. If you need to track generated files,${NC}"
    echo -e "${YELLOW}  add a generation script and run it in CI/pre-test instead.${NC}"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done < <(git diff --cached --name-status 2>/dev/null || true)

if [ $VIOLATIONS -gt 0 ]; then
  echo -e "${RED}✗ Guard: $VIOLATIONS .gitignore deletion(s) blocked${NC}"
  exit 1
fi

exit 0
