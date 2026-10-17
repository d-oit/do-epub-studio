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

Run the automated version propagation script to update `VERSION`, all package manifests, and internal workspace dependencies:

```bash
./scripts/release/version-propagation.sh X.Y.Z
```

Verify with the app identity check:

```bash
node scripts/check-app-identity.mjs
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
with a clean tree, checks `VERSION` against every `package.json`, validates
the `CHANGELOG.md` release section shape with
`scripts/release/check-release-notes.sh <version>` (dated header, sections,
non-empty Breaking Changes, no draft placeholders), runs the full quality
gate, then pushes the annotated tag:

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
| Release notes shape check fails | Fix the `## [X.Y.Z] - YYYY-MM-DD` section in `CHANGELOG.md` (sections present, Breaking Changes stated or `None.`, no `TODO`/`TBD`/`FIXME`/`XXX`/`<placeholder>`) and re-run `scripts/release/check-release-notes.sh <version>` |
| Tag push did not trigger a release | Tags must come from `create-release-tag.sh`; check `gh run list --workflow=release.yml`. A tag pushed with the default `GITHUB_TOKEN` (e.g. by a bot inside CI) triggers nothing — the push must come from a human/agent identity |
| CHANGELOG section missing entries | The release PR must move every `[Unreleased]` bullet (Step 3) |
| Version mismatch in package.json drift | Run `./scripts/release/version-propagation.sh <version>` to synchronize all manifests |
| Quality gate fails | Fix issues before proceeding — never bypass |
| A tag run used the workflow from before your fix | A tag run executes `release.yml` **from the tagged commit**, so fixing the workflow on a later commit changes nothing for an existing tag. To ship the fix on that version: delete the GitHub Release, re-point the tag to the corrected commit, push it again — the commit must be on `main` with green CI (the readiness gate refuses a commit whose CI it cannot verify), and `concurrency: cancel-in-progress: false` queues the new run behind any in-flight run for the same tag |
| Release job failed after the release was created | Re-run failed jobs (`gh run rerun <run-id> --failed`) instead of re-tagging: the re-run keeps the original tag/SHA, the `release` job rebuilds, re-signs and re-attests everything itself (no dependency on the previous attempt's artifacts), and `softprops/action-gh-release` updates the existing release (`overwrite_files` defaults to true). The usual culprit is the fail-closed Pages API health check — fix the Pages deployment/bindings, then re-run. Reruns work for 30 days, up to 50 per run |

## References

- ADR-035: Release Governance & Vulnerability Disclosure Policy — `plans/035-adr-release-governance.md`
- Release-drafter config: `.github/release-drafter.yml` — config only; no drafter *workflow* exists, so it never produces a draft (GOAP-276)
- Workflow definition: `.github/workflows/release.yml`
- `CHANGELOG.md` at repo root
- `VERSION` at repo root
- AGENTS.md Tier 2: "Releases MUST be cut via the release-management skill — no manual tags, no direct CHANGELOG edits"

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "CI is green, so the version is published." | Merging the release PR does **not** create the tag — the version is only publishable after `./scripts/release/create-release-tag.sh` (Step 6). |
| "I'll just push the tag myself — the script is a formality." | The pre-push hook blocks direct `v*` tag pushes; `create-release-tag.sh` is the only sanctioned path and it verifies clean up-to-date `main`, `VERSION` vs every `package.json`, and the release-notes shape first. |
| "I'll tidy the CHANGELOG section after the release publishes." | The section is written exactly once, inside the release PR — never edited after the tag publishes (AGENTS.md Tier 2: no direct CHANGELOG edits). |
| "A bare `git commit -m` is fine for the release PR." | The commit-msg hook rejects a commit with no body — commit through `./scripts/atomic-commit/run.sh --message … --body …`, which also pushes the branch and opens the PR. |
| "This release has no breaking changes, so I can omit that part." | `scripts/release/check-release-notes.sh <version>` requires a dated header, sections, a non-empty Breaking Changes statement, and no `TODO`/`TBD`/`FIXME`/`XXX`/`<placeholder>` draft text. |

## Red Flags

- [ ] A `v*` tag pushed by hand instead of via `create-release-tag.sh`
- [ ] `VERSION` disagreeing with any `package.json` at tag time
- [ ] Release notes with `TODO`/`TBD`/`FIXME`/`XXX`/`<placeholder>` or no Breaking Changes statement
- [ ] `[Unreleased]` bullets left behind after the release PR merges
- [ ] `release:cut` label expected to trigger anything (`release.yml` fires only on a `v*` tag push)

## Integration

- **cicd-pipeline**: For CI/CD workflow configuration
- **github-workflow**: For PR creation and monitoring
- **code-quality**: For pre-release code-smell remediation
