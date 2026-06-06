#!/usr/bin/env bash
# Validate GitHub Actions workflow syntax.
# Checks YAML validity, SHA pinning, and allowed versions.
# Also runs actionlint and zizmor for security scanning.
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

# Ensure local bin directory is in PATH
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"

# Install actionlint if not present
if ! command -v actionlint &> /dev/null; then
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
  esac

  if [[ "$OS" == "linux" || "$OS" == "darwin" ]]; then
    printf '%sInstalling actionlint...%s\n' "${BLUE}" "${NC}"
    URL="https://github.com/rhysd/actionlint/releases/download/v1.6.26/actionlint_1.6.26_${OS}_${ARCH}.tar.gz"
    curl -sSL "$URL" | tar xz -C "$HOME/.local/bin" actionlint || true
  fi
fi

# Install zizmor if not present
if ! command -v zizmor &> /dev/null; then
  printf '%sInstalling zizmor...%s\n' "${BLUE}" "${NC}"
  pip install zizmor --quiet 2>/dev/null || pip install zizmor --quiet --break-system-packages 2>/dev/null || true
fi

# Find all workflow files
mapfile -t WORKFLOW_FILES < <(find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null || true)

if [ ${#WORKFLOW_FILES[@]} -eq 0 ]; then
    printf '%s✓ No workflow files found — skipping validation%s\n' "${GREEN}" "${NC}"
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

# Check for actionlint
ACTIONLINT=""
if command -v actionlint &> /dev/null; then
    ACTIONLINT="actionlint"
    # Ensure the resolved binary is executable. pip/curl installs into
    # $HOME/.local/bin can intermittently drop the exec bit, causing
    # "Permission denied" mid-run (see issue #439).
    chmod u+x "$(command -v actionlint)" 2>/dev/null || true
fi

# Check for zizmor
ZIZMOR=""
if command -v zizmor &> /dev/null; then
    ZIZMOR="zizmor"
    # Guard against intermittent "Permission denied" on the pip-installed
    # zizmor launcher by guaranteeing the exec bit before use (issue #439).
    chmod u+x "$(command -v zizmor)" 2>/dev/null || true
fi

for file in "${WORKFLOW_FILES[@]}"; do
    printf '%sChecking: %s%s\n' "${BLUE}" "$file" "${NC}"
    FILE_FAILED=0

    # 1. Check YAML syntax
    if [ "$YAML_VALIDATOR" == "yamllint" ]; then
        # Disable 'truthy' rule because 'on:' is incorrectly flagged as a boolean
        if ! yamllint -d "{extends: default, rules: {line-length: disable, document-start: disable, truthy: disable}}" "$file"; then
            printf '%s  ✗ YAML syntax errors (yamllint): %s%s\n' "${RED}" "$file" "${NC}"
            FILE_FAILED=1
        fi
    elif [ "$YAML_VALIDATOR" == "node-js-yaml" ]; then
        if ! FILE="$file" node -e "const yaml = require('js-yaml'); const fs = require('fs'); try { yaml.load(fs.readFileSync(process.env.FILE, 'utf8')); } catch (e) { console.error(e.message); process.exit(1); }" ; then
            printf '%s  ✗ Invalid YAML syntax (js-yaml): %s%s\n' "${RED}" "$file" "${NC}"
            FILE_FAILED=1
        fi
    elif [ "$YAML_VALIDATOR" == "python3" ]; then
        if ! FILE="$file" python3 -c "import yaml, os; yaml.safe_load(open(os.environ['FILE']))" 2>/dev/null; then
            printf '%s  ✗ Invalid YAML syntax (PyYAML): %s%s\n' "${RED}" "$file" "${NC}"
            FILE_FAILED=1
        fi
    else
        printf '%s  ⚠ No YAML validator found (skipping syntax check)%s\n' "${YELLOW}" "${NC}"
    fi

    # 1.1 Check with actionlint
    if [ "$ACTIONLINT" == "actionlint" ]; then
        if ! actionlint "$file"; then
            printf '%s  ✗ actionlint failures: %s%s\n' "${RED}" "$file" "${NC}"
            FILE_FAILED=1
        fi
    else
        printf '%s  ⚠ actionlint not found (skipping)%s\n' "${YELLOW}" "${NC}"
    fi

    # 1.2 Check with zizmor (only fail on medium severity and above)
    if [ "$ZIZMOR" == "zizmor" ]; then
        if ! zizmor --min-severity medium "$file"; then
            printf '%s  ✗ zizmor failures: %s%s\n' "${RED}" "$file" "${NC}"
            FILE_FAILED=1
        fi
    else
        printf '%s  ⚠ zizmor not found (skipping)%s\n' "${YELLOW}" "${NC}"
    fi

    # 2. Check for required top-level keys
    if ! grep -q "^on:" "$file" && ! grep -q "^on:$" "$file"; then
        printf '%s  ✗ Missing "on:" trigger%s\n' "${RED}" "${NC}"
        FILE_FAILED=1
    fi

    if ! grep -q "^jobs:" "$file"; then
        printf '%s  ✗ Missing "jobs:" key%s\n' "${RED}" "${NC}"
        FILE_FAILED=1
    fi

    # 3. Check for potentially missing permissions
    if ! grep -q "permissions:" "$file"; then
        printf '%s  ⚠ Missing explicit permissions (non-blocking)%s\n' "${YELLOW}" "${NC}"
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
            printf '%s  ✗ Action not pinned to SHA at line %s: %s%s\n' "${RED}" "$line_num" "$uses_val" "${NC}"
            FILE_FAILED=1
        else
            # Check if SHA is allowed
            action_with_sha=$(echo "$uses_val" | cut -d' ' -f1)
            if ! is_allowed_sha "$action_with_sha"; then
                printf '%s  ✗ Disallowed or unverified SHA at line %s: %s%s\n' "${RED}" "$line_num" "$action_with_sha" "${NC}"
                FILE_FAILED=1
            fi
        fi
    done < <(grep -nE "^[[:space:]]*-?[[:space:]]*uses:" "$file" || true)

    if [ $FILE_FAILED -eq 0 ]; then
        printf '%s  ✓ %s passed validation%s\n' "${GREEN}" "$file" "${NC}"
    else
        FAILED=1
    fi
done

echo ""

if [ $FAILED -ne 0 ]; then
    printf '%s✗ Workflow validation FAILED%s\n' "${RED}" "${NC}"
    exit 2
fi

printf '%s✓ All %d workflow(s) validated successfully%s\n' "${GREEN}" "${#WORKFLOW_FILES[@]}" "${NC}"
exit 0
