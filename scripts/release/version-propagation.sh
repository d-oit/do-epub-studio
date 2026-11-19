#!/usr/bin/env bash
# scripts/release/version-propagation.sh — Propagate release version to VERSION
# and root plus immediate apps/packages package.json manifests.
# Usage: ./scripts/release/version-propagation.sh <X.Y.Z> [--dry-run]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT" || exit 1

# shellcheck source=scripts/lib/colors.sh
source "$REPO_ROOT/scripts/lib/colors.sh"

VERSION=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      echo "Usage: $0 <version> [--dry-run]"
      echo "  version     Target semver version (e.g., 0.2.0)"
      echo "  --dry-run   Show changes without writing files"
      exit 0
      ;;
    --dry-run)
      DRY_RUN=true
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
  echo "Usage: $0 <version> [--dry-run]" >&2
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

if ! PKG_FILES="$(node "$REPO_ROOT/scripts/lib/workspace-manifests.mjs" "$REPO_ROOT")"; then
  printf '%s✗ Failed to enumerate workspace package manifests%s\n' "$RED" "$NC" >&2
  exit 1
fi

# Validate every selected manifest before writing VERSION or any package file.
while IFS= read -r pkg_file; do
  [[ -n "$pkg_file" ]] || continue
  if ! node - "$pkg_file" >/dev/null <<'NODE'
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
  throw new TypeError("manifest must contain a JSON object");
}
for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
  if (pkg[section] === undefined) continue;
  if (!pkg[section] || typeof pkg[section] !== "object" || Array.isArray(pkg[section])) {
    throw new TypeError(`${section} must be a JSON object`);
  }
  for (const [name, value] of Object.entries(pkg[section])) {
    if (name.startsWith("@do-epub-studio/") && typeof value !== "string") {
      throw new TypeError(`${section}.${name} must be a string`);
    }
  }
}
NODE
  then
    printf '%s✗ Invalid workspace package manifest: %s%s\n' "$RED" "$pkg_file" "$NC" >&2
    exit 1
  fi
done <<< "$PKG_FILES"

# Update VERSION only after the complete selected manifest set is valid.
if [[ "$DRY_RUN" == "true" ]]; then
  printf '  [dry-run] Would update %sVERSION%s to %s\n' "$GREEN" "$NC" "$VERSION"
else
  printf '%s\n' "$VERSION" > "$REPO_ROOT/VERSION"
  printf '  ✓ Updated %sVERSION%s -> %s\n' "$GREEN" "$NC" "$VERSION"
fi

UPDATED_COUNT=0
while IFS= read -r pkg_file; do
  [[ -n "$pkg_file" ]] || continue
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '  [dry-run] Would update %s%s%s version to %s\n' "$GREEN" "$pkg_file" "$NC" "$VERSION"
    UPDATED_COUNT=$((UPDATED_COUNT + 1))
  else
    node - "$pkg_file" "$VERSION" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const targetVersion = process.argv[3];
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
NODE
    printf '  ✓ Updated %s%s%s\n' "$GREEN" "$pkg_file" "$NC"
    UPDATED_COUNT=$((UPDATED_COUNT + 1))
  fi
done <<< "$PKG_FILES"

printf 'Updated %d package.json file(s).\n' "$UPDATED_COUNT"
# Identity/version verification is mandatory on every real write; --dry-run previews only.
if [[ "$DRY_RUN" != "true" ]]; then
  echo "Verifying app identity and version governance..."
  if ! node "$REPO_ROOT/scripts/check-app-identity.mjs"; then
    printf '%s✗ App identity verification failed after version propagation%s\n' "$RED" "$NC" >&2
    exit 1
  fi
fi

printf '%s✓ Version propagation to %s complete.%s\n' "$GREEN" "$VERSION" "$NC"
