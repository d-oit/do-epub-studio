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
- [ ] Every PR expected in this release is merged into `main`
- [ ] `VERSION` file reflects the current unreleased version
- [ ] No `v*` tag exists yet for this version (`git ls-remote --tags origin vX.Y.Z`)

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

### Step 3 — Move `[Unreleased]` Entries into the Release Section

There is no changelog sync script — `scripts/release/` contains only
`create-release-tag.sh` — so edit `CHANGELOG.md` as part of the release PR:

1. Add a `## [X.Y.Z] - YYYY-MM-DD` heading (date from `date +%Y-%m-%d`).
2. Move every bullet out of `[Unreleased]` into that section, grouped the
   way previous release sections are grouped.
3. Leave the `[Unreleased]` heading in place with an empty list.

The section is written exactly once, inside the release PR — never edited
after the tag publishes (AGENTS.md Tier 2: no direct CHANGELOG edits).

### Step 4 — Open Release PR

Stage the release files (VERSION, CHANGELOG.md, every touched
`package.json`) and commit through the atomic-commit script — a bare
`git commit -m` without a body fails the commit-msg hook, and nothing in
this flow consumes a `release:cut` label (`release.yml` triggers only on
a `v*` tag push, GOAP-276):

```bash
git checkout -b release/vX.Y.Z
git add -u
./scripts/atomic-commit/run.sh \
  --message "chore(release): vX.Y.Z" \
  --body "Release vX.Y.Z: version bump and changelog section."
```

`run.sh` pushes the branch and opens the PR.

### Step 5 — Merge PR

Squash-merge the release PR once CI is green. Merging does **not** create
the tag — the version is only publishable after Step 6.

### Step 6 — Cut the Tag

The tag is the release trigger, and `create-release-tag.sh` is the only
sanctioned way to push it — it verifies you are on an up-to-date `main`
with a clean tree, checks `VERSION` against every `package.json`, runs the
full quality gate, then pushes the annotated tag:

```bash
./scripts/release/create-release-tag.sh
```

The `v*` tag push triggers `.github/workflows/release.yml` (readiness
gate → perf + Lighthouse gates → build, SBOM, cosign signing, SLSA
provenance → GitHub Release → fail-closed health check).

### Step 7 — Verify

```bash
# Check the release published
gh release view vX.Y.Z

# Verify tag exists
git ls-remote --tags origin vX.Y.Z

# Confirm CHANGELOG has the new section
head -20 CHANGELOG.md
```

## Hard Rules

- **NEVER push a `v*` tag manually** — always use `scripts/release/create-release-tag.sh <version>`. The pre-push hook blocks direct tag pushes; the script runs the quality gate and version checks first.
- **NEVER tag `main` directly** — always use the release PR path, then `create-release-tag.sh`
- **NEVER edit a published release's CHANGELOG section** — release sections are written once, in the release PR (Step 3)
- **NEVER merge a release PR without CI passing** — the tag push triggers `release.yml` which requires all checks to pass
- **NEVER skip the quality gate** — a failing gate blocks the entire workflow

## Dry-Run Mode

For rehearsing the flow without publishing anything:

```bash
# 1. Run the quality gate
./scripts/quality_gate.sh

# 2. Draft the VERSION bump and CHANGELOG section locally, then review
git diff

# 3. Stop here — never push the branch or the tag in a dry run;
#    create-release-tag.sh is the only sanctioned tag path
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tag push did not trigger a release | Tags must come from `create-release-tag.sh`; check `gh run list --workflow=release.yml` |
| CHANGELOG section missing entries | The release PR must move every `[Unreleased]` bullet (Step 3) |
| Version mismatch in package.json drift | Use `find ... -exec sed` approach from Step 2; then verify with `grep` |
| Quality gate fails | Fix issues before proceeding — never bypass |

## References

- ADR-035: Release Governance & Vulnerability Disclosure Policy — `plans/035-adr-release-governance.md`
- Release-drafter config: `.github/release-drafter.yml` — config only; no drafter *workflow* exists, so it never produces a draft (GOAP-276)
- Workflow definition: `.github/workflows/release.yml`
- `CHANGELOG.md` at repo root
- `VERSION` at repo root
- AGENTS.md Tier 2: "Releases MUST be cut via the release-management skill — no manual tags, no direct CHANGELOG edits"

## Integration

- **cicd-pipeline**: For CI/CD workflow configuration
- **github-workflow**: For PR creation and monitoring
- **code-quality**: For pre-release code-smell remediation
