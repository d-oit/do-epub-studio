#!/usr/bin/env bash
# Sanctioned release tag creator.
# This is the ONLY way to push a v* tag. The pre-push hook blocks direct tag pushes.
#
# Usage: scripts/release/create-release-tag.sh [version]
#   version — optional; defaults to content of VERSION file (e.g. "0.1.0")
#
# Steps performed:
#   1. Verify working tree is clean and on main
#   2. Run the quality gate (./scripts/quality_gate.sh)
#   3. Verify VERSION file matches all package.json versions
#   4. Create and push the annotated tag vX.Y.Z
#   5. The push triggers .github/workflows/release.yml automatically
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

source "$REPO_ROOT/scripts/lib/colors.sh"

VERSION="${1:-$(tr -d '[:space:]' < VERSION)}"

if [[ -z "$VERSION" ]]; then
    echo -e "${RED}✗ No version provided and VERSION file is empty${NC}" >&2
    exit 1
fi

# Validate semver format
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}✗ Invalid version format: '$VERSION' — expected X.Y.Z${NC}" >&2
    exit 1
fi

TAG="v${VERSION}"
echo "Preparing release $TAG..."
echo ""

# 1. Verify on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo -e "${RED}✗ Must be on main branch to cut a release (currently on '$CURRENT_BRANCH')${NC}" >&2
    exit 1
fi

# 2. Verify clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${RED}✗ Working tree is not clean. Commit or stash changes first.${NC}" >&2
    git status --short >&2
    exit 1
fi

# 3. Pull latest
echo "Pulling latest main..."
git pull --ff-only origin main

# 4. Verify VERSION file matches
FILE_VERSION=$(tr -d '[:space:]' < VERSION)
if [[ "$FILE_VERSION" != "$VERSION" ]]; then
    echo -e "${RED}✗ VERSION file contains '$FILE_VERSION' but you requested '$VERSION'${NC}" >&2
    echo "Update the VERSION file and all package.json files first." >&2
    exit 1
fi

# 5. Verify all package.json files match
echo "Verifying package versions..."
MISMATCHED=()
while IFS= read -r pkg; do
    PKG_VERSION=$(node -e "console.log(require('$pkg').version)" 2>/dev/null || echo "")
    if [[ "$PKG_VERSION" != "$VERSION" ]]; then
        MISMATCHED+=("$pkg (has $PKG_VERSION)")
    fi
done < <(find . -name 'package.json' -not -path '*/node_modules/*' -not -path '*/.turbo/*' | sort)

if [[ ${#MISMATCHED[@]} -gt 0 ]]; then
    echo -e "${RED}✗ Version mismatch in:${NC}" >&2
    for m in "${MISMATCHED[@]}"; do echo "  $m" >&2; done
    echo "Run: find . -name 'package.json' -not -path '*/node_modules/*' -exec sed -i 's/\"version\": \".*\"/\"version\": \"$VERSION\"/' {} +" >&2
    exit 1
fi

# 6. Run quality gate
echo "Running quality gate..."
if ! ./scripts/quality_gate.sh; then
    echo -e "${RED}✗ Quality gate failed — fix issues before releasing${NC}" >&2
    exit 1
fi

# 7. Create annotated tag and push (RELEASE_SCRIPT_PUSH bypasses pre-push hook)
echo ""
echo "Creating annotated tag $TAG..."
git tag -a "$TAG" -m "Release $TAG"

echo "Pushing tag $TAG (triggers release.yml)..."
RELEASE_SCRIPT_PUSH=1 git push origin "$TAG"

echo ""
echo -e "${GREEN}✓ Tag $TAG pushed. Monitor release progress:${NC}"
echo "  gh run list --workflow=release.yml"
echo "  gh release view $TAG  (once published)"
