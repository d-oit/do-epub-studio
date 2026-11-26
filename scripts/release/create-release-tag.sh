#!/usr/bin/env bash
# Sanctioned release tag creator.
# This is the ONLY way to push a v* tag. The pre-push hook blocks direct tag pushes.
#
# Usage: scripts/release/create-release-tag.sh [version]
#   version — optional; defaults to content of VERSION file (e.g. "0.1.0")
#
# Steps performed:
#   1. Verify main/clean state and pull the latest main
#   2. Verify VERSION against root + immediate apps/packages manifests
#   3. Verify release notes and the pinned harness identity
#   4. Run the full quality gate and mandatory release signal set
#   5. Create and push the annotated tag vX.Y.Z, triggering release.yml
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

echo "Verifying workspace package versions..."
if ! PKG_FILES="$(node "$REPO_ROOT/scripts/lib/workspace-manifests.mjs" "$REPO_ROOT")"; then
    echo -e "${RED}✗ Failed to enumerate workspace package manifests${NC}" >&2
    exit 1
fi

MISMATCHED=()
while IFS= read -r pkg; do
    [[ -n "$pkg" ]] || continue
    if ! PKG_VERSION="$(node - "$pkg" <<'NODE'
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) process.exit(2);
console.log(pkg.version ?? "");
NODE
    )"; then
        MISMATCHED+=("$pkg (invalid JSON)")
    elif [[ "$PKG_VERSION" != "$VERSION" ]]; then
        MISMATCHED+=("$pkg (has $PKG_VERSION)")
    fi
done <<< "$PKG_FILES"

if [[ ${#MISMATCHED[@]} -gt 0 ]]; then
    echo -e "${RED}✗ Version mismatch in:${NC}" >&2
    for m in "${MISMATCHED[@]}"; do echo "  $m" >&2; done
    echo "Run: ./scripts/release/version-propagation.sh $VERSION" >&2
    exit 1
fi

# 5b. Verify CHANGELOG release section shape (GOAP-276 Phase 1)
echo "Checking release notes..."
if ! ./scripts/release/check-release-notes.sh "$VERSION"; then
    echo -e "${RED}✗ Release notes invalid for $TAG — fix CHANGELOG.md before releasing${NC}" >&2
    exit 1
fi

# The release gate cannot be skipped for a missing or mismatched local binary.
echo "Checking pinned do-harness identity..."
if ! node "$REPO_ROOT/scripts/check-harness-version.mjs"; then
    echo -e "${RED}✗ Required do-harness version is unavailable or mismatched${NC}" >&2
    exit 1
fi

# 6. Run quality gate
echo "Running quality gate..."
if ! ./scripts/quality_gate.sh; then
    echo -e "${RED}✗ Quality gate failed — fix issues before releasing${NC}" >&2
    exit 1
fi

# 6b. Verify release signal set via do-harness (mandatory, recorded evidence)
echo "Verifying release signal set with do-harness..."
if ! DO_HARNESS_AUTO_REPORT=off do-harness verify --set release --strict --record; then
    echo -e "${RED}✗ do-harness release verification failed — fix issues before releasing${NC}" >&2
    exit 1
fi

if ! RELEASE_STATUS="$(DO_HARNESS_AUTO_REPORT=off do-harness status --set release --format json)"; then
    echo -e "${RED}✗ Could not read do-harness release evidence status${NC}" >&2
    exit 1
fi
if ! node - "$RELEASE_STATUS" <<'NODE'
const status = JSON.parse(process.argv[2]);
if (status.state !== "green" || status.reason !== "current") process.exit(1);
NODE
then
    echo -e "${RED}✗ do-harness release evidence is not current and green${NC}" >&2
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
