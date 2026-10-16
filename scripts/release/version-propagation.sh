#!/usr/bin/env bash
# scripts/release/version-propagation.sh — Propagate release version to VERSION and package.json files.
# Usage: ./scripts/release/version-propagation.sh <X.Y.Z> [--dry-run] [--no-verify]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT" || exit 1

# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

VERSION=""
DRY_RUN=false
VERIFY=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      echo "Usage: $0 <version> [--dry-run] [--no-verify]"
      echo "  version     Target semver version (e.g., 0.2.0)"
      echo "  --dry-run   Show changes without writing files"
      echo "  --no-verify Skip check-app-identity verification"
      exit 0
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --no-verify)
      VERIFY=false
      shift
      ;;
    *)
      if [[ -z "$VERSION" ]]; then
        VERSION="$1"
      else
        printf '%s✗ Unexpected argument: %s%s\n' "$RED" "$1" "$NC" >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$VERSION" ]]; then
  printf '%s✗ Version argument required%s\n' "$RED" "$NC" >&2
  echo "Usage: $0 <version> [--dry-run] [--no-verify]" >&2
  exit 1
fi

# Strip leading 'v' if provided
VERSION="${VERSION#v}"

# Validate semver format
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  printf '%s✗ Invalid semver format: %s (expected X.Y.Z)%s\n' "$RED" "$VERSION" "$NC" >&2
  exit 1
fi

printf 'Propagating version %s%s%s across repository...\n' "$BLUE" "$VERSION" "$NC"

# Update VERSION file
if [[ "$DRY_RUN" == "true" ]]; then
  printf '  [dry-run] Would update %sVERSION%s to %s\n' "$GREEN" "$NC" "$VERSION"
else
  printf '%s\n' "$VERSION" > "$REPO_ROOT/VERSION"
  printf '  ✓ Updated %sVERSION%s -> %s\n' "$GREEN" "$NC" "$VERSION"
fi

# Find and update all package.json files
PKG_FILES=$(find . -name 'package.json' \
  -not -path '*/node_modules/*' \
  -not -path '*/.turbo/*' \
  -not -path '*/dist/*' \
  -not -path '*/.git/*' | sort)

UPDATED_COUNT=0
while IFS= read -r pkg_file; do
  [[ -n "$pkg_file" ]] || continue
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '  [dry-run] Would update %s%s%s version to %s\n' "$GREEN" "$pkg_file" "$NC" "$VERSION"
    UPDATED_COUNT=$((UPDATED_COUNT + 1))
  else
    node -e '
      const fs = require("node:fs");
      const file = process.argv[1];
      const targetVersion = process.argv[2];
      const content = fs.readFileSync(file, "utf8");
      const pkg = JSON.parse(content);
      pkg.version = targetVersion;
      for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
        if (!pkg[section]) continue;
        for (const dep of Object.keys(pkg[section])) {
          if (dep.startsWith("@do-epub-studio/")) {
            const val = pkg[section][dep];
            if (val.startsWith("workspace:^")) {
              pkg[section][dep] = `workspace:^${targetVersion}`;
            } else if (val.startsWith("workspace:~")) {
              pkg[section][dep] = `workspace:~${targetVersion}`;
            } else if (val === "workspace:*" || val === "workspace:") {
              // keep wildcard workspace intact
            } else if (val.startsWith("workspace:")) {
              pkg[section][dep] = `workspace:^${targetVersion}`;
            }
          }
        }
      }
      fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    ' "$pkg_file" "$VERSION"
    printf '  ✓ Updated %s%s%s\n' "$GREEN" "$pkg_file" "$NC"
    UPDATED_COUNT=$((UPDATED_COUNT + 1))
  fi
done <<< "$PKG_FILES"

printf 'Updated %d package.json file(s).\n' "$UPDATED_COUNT"

if [[ "$VERIFY" == "true" && "$DRY_RUN" != "true" ]]; then
  echo "Verifying app identity and version governance..."
  if ! node "$REPO_ROOT/scripts/check-app-identity.mjs"; then
    printf '%s✗ App identity verification failed after version propagation%s\n' "$RED" "$NC" >&2
    exit 1
  fi
fi

printf '%s✓ Version propagation to %s complete.%s\n' "$GREEN" "$VERSION" "$NC"
