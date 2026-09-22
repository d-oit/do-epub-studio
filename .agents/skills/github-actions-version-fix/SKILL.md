---
version: "1.0.0"
name: github-actions-version-fix
description: Fix GitHub Actions "Unable to resolve action" errors using gh CLI to find correct version tags or commit SHAs.
category: workflow
allowed-tools: Read Write Edit Glob Grep Bash
license: MIT
---

# GitHub Actions Version Fix Skill

Fix CI pipeline failures caused by incorrect action version tags or commit SHAs in GitHub workflow files.

## When to Use

- CI fails with "Unable to resolve action" error
- Action version tag doesn't exist or is outdated
- Pinned commit SHA is invalid or has changed
- Need to update an action to a working version

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- Read access to the action's repository

## Quick Fix Workflow

### Step 1: Identify the Problem

Error message shows: `Unable to resolve action {owner}/{repo}, version {version} not found`

Extract the action and version, e.g., `actions/upload-artifact@v4.6.1`

### Step 2: Find Correct Version/SHA

```bash
# List all tags for an action
gh api repos/{owner}/{repo}/tags --jq '.[].name' | head -20

# List releases (more stable than tags)
gh api repos/{owner}/{repo}/releases --jq '.[].tag_name' | head -20

# Get latest release
gh api repos/{owner}/{repo}/releases/latest --jq '.tag_name'

# Get commit SHA for a specific tag
gh api repos/{owner}/{repo}/git/ref/tags/v4 --jq '.object.sha'
```

### Step 3: Verify SHA Exists

```bash
# Check if commit SHA is valid
gh api repos/{owner}/{repo}/commits/{sha}
```

### Step 4: Update Workflow File

```yaml
# Before (fails)
- uses: actions/upload-artifact@v4.6.1

# After (using version tag)
- uses: actions/upload-artifact@v4

# After (using full commit SHA - most stable)
- uses: actions/upload-artifact@4cec3d8aa04e39d1a68397de0c4cd6fb9dce8ec1
```

## Common Error Solutions

| Error | Solution |
|-------|----------|
| `Unable to resolve action` | Find correct tag via `gh api` |
| `404 Not Found` | Check owner/repo name |
| `Reference does not exist` | Verify SHA exists |
| `Tag not found` | Use different tag or SHA |

## Pin-Comment & zizmor Rules

`validate-workflows.sh` runs zizmor, which rejects a `uses: …@<sha>` whose
trailing version comment doesn't match the tag GitHub actually has
(audit `ref-version-mismatch`):

- **Tag names are not uniformly `v`-prefixed**: `treosh/lighthouse-ci-action`
  is tagged `12.6.2`, so a `# v12.6.2` comment fails. Verify before editing
  either side: `gh api repos/<owner>/<repo>/matching-refs/tags/<prefix> --jq '.[].ref'`.
- **The failure surfaces as `pnpm lint failed`**, not a workflow error: the
  root lint script chains `turbo run lint && pnpm lint:workflows`, so read the
  *tail* of the output — the ESLint header is a red herring.
- **Verify tags with `git ls-remote <upstream> "refs/tags/<tag>^{}"`**
  (annotated) and fall back to the plain ref for lightweight tags. The GitHub
  tags API returns the tag *object*, so its SHA is wrong for a `uses:` pin.
- **Local zizmor on pip-less images**: the validator's pip fallbacks fail
  silently (`No module named pip`); `uv tool install zizmor` works but lands in
  `~/.local/bin`, which must be exported on `PATH` or the validator finds nothing.

## Best Practices

1. **Prefer releases over tags** - More stable
2. **Use full SHAs for critical actions** - Prevents supply chain attacks
3. **Update regularly** - Keep actions current
4. **Use Dependabot** - Automate version updates

## Automated Check Script

```bash
#!/bin/bash
# check-workflow-actions.sh <workflow-file>

WORKFLOW_FILE="$1"
ACTIONS=$(grep -E "^\s+- uses:" "$WORKFLOW_FILE" | sed 's/.*uses: //' | sort -u)

for ACTION in $ACTIONS; do
  REPO=$(echo $ACTION | cut -d'@' -f1)
  VERSION=$(echo $ACTION | cut -d'@' -f2)
  OWNER=$(echo $REPO | cut -d'/' -f1)
  NAME=$(echo $REPO | cut -d'/' -f2)

  if [[ $VERSION == v* ]]; then
    SHA=$(gh api repos/$OWNER/$NAME/git/ref/tags/$VERSION --jq '.object.sha' 2>/dev/null)
    [ -n "$SHA" ] && echo "OK: $REPO@$VERSION" || echo "FAIL: $REPO@$VERSION"
  fi
done
```

## YAML Validation

```bash
# Validate syntax
python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"

# Or use yamllint
yamllint .github/workflows/
```

## Quality Checklist

- [ ] Identified exact action causing error
- [ ] Used `gh api` to find correct version/SHA
- [ ] Verified SHA exists before updating
- [ ] Updated all workflow files with the action
- [ ] Validated YAML syntax after changes
- [ ] Tested workflow runs successfully

## Summary

Use `gh api` to find correct version tags or commit SHAs when actions fail to resolve. Prefer full SHAs for security-critical actions and validate YAML before committing.
