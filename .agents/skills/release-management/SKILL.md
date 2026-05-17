---
version: "1.0.0"
name: release-management
description: >
  Cut releases, bump versions, sync changelog, and publish GitHub Releases.
  Activates on "cut a release", "bump version", "publish vX", "create release".
category: workflow
allowed-tools: Read Write Edit Bash
license: MIT
---

# Release Management

Cut releases, bump versions, sync changelog, and publish GitHub Releases.

## When to Use

- "cut a release"
- "bump version"
- "publish vX.Y.Z"
- "create release"
- "tag a version"

## Pre-Flight Checklist

- [ ] Quality gate passes: `./scripts/quality_gate.sh`
- [ ] All CI checks pass on main
- [ ] `CHANGELOG.md` has a populated `[Unreleased]` section
- [ ] No unmerged PRs targeting this release that lack the required label
- [ ] `VERSION` file reflects the current unreleased version
- [ ] Release-drafter draft is up-to-date (pushed to main recently)

## Release Workflow

### Step 1 — Determine Next Version

Read the current version:

```bash
cat VERSION
```

Apply semantic versioning per Conventional Commits since last release:

- `fix(...)` → patch
- `feat(...)` → minor (pre-1.0.0: minor for any feat)
- `feat(...)!` or `BREAKING CHANGE:` footer → major

### Step 2 — Bump Version

Update `VERSION` at repo root:

```bash
echo "X.Y.Z" > VERSION
```

Update every `package.json` that references the version:

```bash
# Find all package.json files and update version field
find . -name 'package.json' -not -path '*/node_modules/*' \
  -exec sed -i "s/\"version\": \".*\"/\"version\": \"X.Y.Z\"/" {} +
```

Update cross-package dependency references if any internal deps use a range:

```bash
# Update workspace dependency versions
find . -name 'package.json' -not -path '*/node_modules/*' \
  -exec sed -i "s/\"@do-epub-studio\/[^\"]*\": \"workspace:[\^~]\?[0-9.]*\"/\"@do-epub-studio\/shared\": \"workspace:^X.Y.Z\"/" {} +
```

### Step 3 — Sync Changelog

Run the changelog sync script:

```bash
./scripts/release/sync-changelog.sh
```

This pulls the current release-drafter draft notes, writes a `## [X.Y.Z] - YYYY-MM-DD` section in `CHANGELOG.md`, and resets `[Unreleased]`.

**NEVER manually edit CHANGELOG for a release section** — only via this script.

### Step 4 — Open Release PR

Create a PR titled `chore(release): vX.Y.Z`:

```bash
git checkout -b release/vX.Y.Z
git add -A
git commit -m "chore(release): vX.Y.Z"
git push -u origin HEAD
gh pr create \
  --title "chore(release): vX.Y.Z" \
  --body "Release vX.Y.Z" \
  --label "release:cut"
```

### Step 5 — Merge PR

Merge the release PR via squash merge once CI passes. The `release:cut` label triggers `release.yml` which:

1. Promotes the release-drafter draft to a published GitHub Release
2. Creates the git tag `vX.Y.Z`
3. Builds and deploys artifacts

### Step 6 — Verify

```bash
# Check the release published
gh release view vX.Y.Z

# Verify tag exists
git ls-remote --tags origin vX.Y.Z

# Confirm CHANGELOG has the new section
head -20 CHANGELOG.md
```

## Hard Rules

- **NEVER tag `main` directly** — always use the release PR path
- **NEVER manually edit CHANGELOG for a release section** — always use `sync-changelog.sh`
- **NEVER merge a release PR without CI passing** — the `release:cut` label triggers production publishing
- **NEVER skip the quality gate** — a failing gate blocks the entire workflow

## Dry-Run Mode

For testing the workflow without publishing:

```bash
# 1. Run quality gate
./scripts/quality_gate.sh

# 2. Bump locally but don't commit
echo "X.Y.Z-rc.1" > VERSION

# 3. Run sync-changelog in dry-run mode (if supported)
./scripts/release/sync-changelog.sh --dry-run

# 4. Review diff without pushing
git diff
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Release-drafter draft is stale | Push a trivial commit to main or re-trigger the workflow |
| `release:cut` label not triggering release | Check `.github/workflows/release.yml` trigger conditions |
| CHANGELOG section is empty | Verify `sync-changelog.sh` ran successfully; check release-drafter output |
| Version mismatch in package.json drift | Use `find ... -exec sed` approach from Step 2; then verify with `grep` |
| Quality gate fails | Fix issues before proceeding — never bypass |

## References

- ADR-035: Release Governance & Vulnerability Disclosure Policy — `plans/035-adr-release-governance.md`
- Release-drafter config: `.github/release-drafter.yml`
- Workflow definition: `.github/workflows/release.yml`
- `CHANGELOG.md` at repo root
- `VERSION` at repo root
- AGENTS.md Tier 2: "Releases MUST be cut via the release-management skill — no manual tags, no direct CHANGELOG edits"

## Integration

- **cicd-pipeline**: For CI/CD workflow configuration
- **github-workflow**: For PR creation and monitoring
- **code-quality**: For pre-release code-smell remediation