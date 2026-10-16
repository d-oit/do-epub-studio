---
version: "1.0.0"
name: github-workflow
description: >
  Complete GitHub workflow automation - push, create branch/PR, monitor Actions
  with pre-existing issue detection, auto-merge/rebase when checks pass.
category: workflow
allowed-tools: Read Write Edit Glob Grep Bash
license: MIT
---

# GitHub Workflow Skill

Complete GitHub workflow automation for the full development lifecycle.

## When to Use

- Pushing changes to remote
- Creating branches and PRs
- Monitoring GitHub Actions runs
- Auto-merging approved PRs
- Handling PR conflicts

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- Appropriate repository permissions
- Git remote configured

## Core Workflows

### Quick Push

```bash
# Stage, commit, and push in one command
gh auth status
git add -A
git commit -m "type(scope): description"
git push -u origin HEAD
```

### Branch + PR Creation

```bash
# Create branch from current state
gh branch create feature/my-feature

# Or create PR directly
gh pr create --title "feat(scope): description" --body "Description"
```

### Monitor Actions

```bash
# List recent workflow runs
gh run list --limit 10

# Watch specific run
gh run watch <run-id>

# Get run status
gh run view <run-id> --log
```

### Merge Workflow (no automerge — requires explicit human confirmation)

```bash
# Never use `--admin` (bypasses branch protection) or `--auto` (automerge):
# the repo enforces an explicit no-automerge rule (AGENTS.md Tier 1). Before any
# merge, confirm the action explicitly with the user, verify every required
# check is green (`gh pr checks <pr-number>`), then merge on their go-ahead:
gh pr checks <pr-number>
gh pr merge <pr-number> --squash
```

## Pre-Existing Issue Detection

### Detect Before Push

```bash
# Check for pre-existing failures in main
gh run list --branch main --limit 5

# Look for known issue labels
gh issue list --label "bug" --state open
```

### Handle Known Issues

1. **Check** - Run health-check before pushing
2. **Document** - Add to agents-docs/KNOWN-ISSUES.md if new
3. **Verify** - Ensure your changes don't depend on broken functionality

## Quality Gates Integration

### Pre-Push Checklist

- [ ] Quality gate passes: `./scripts/quality_gate.sh`
- [ ] Commit message follows convention
- [ ] No secrets or tokens in changes
- [ ] Branch is up-to-date with main

### Post-Push Validation

```bash
# Wait for CI to complete
gh run watch <run-id> --exit-zero

# Check for failures
gh run list --branch <branch> --status failure
```

### Deploy Integrations (Vercel / Cloudflare Pages)

- **Every push — force-pushes included — and every merge to main triggers a build per connected project, and Vercel's Hobby plan caps free deployments** (`api-deployments-free-per-day`). Exhaust it and Vercel reports `Deployment rate limited — retry in 24 hours` (or `Deployment has failed — run npx vercel inspect <dpl> --logs`) on main and PR heads alike until the window rolls. Batch fixes into **one push per revision** and count merges as pushes; exploratory re-pushes buy nothing and can cost the whole quota.
- **Read the three states**: `Deployment has completed` = green; `rate limited` = quota, never code; `Deployment has failed` = inspect the named deployment before blaming the tree — a quota-window casualty can read this way.
- **Both integrations are non-required** (ADR-286 set; only Codacy is ruleset-required): merge on required-green + not-BEHIND + zero unresolved threads (precedent: #1304 merged with Chromatic's non-required `UI Tests` pending), retry deployments from the dashboard after the window, never `--admin`/`--auto`. Validate serving independently of check states: `curl -sS -o /dev/null -w '%{http_code}\n' https://do-epub-studio.pages.dev` and `curl -sS https://do-epub-studio.pages.dev/api/health` (expect `{"ok":true,…}`).

## Common Patterns

### Feature Branch Flow

```bash
# 1. Update main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/my-feature

# 3. Work and commit
git add -A
git commit -m "feat(scope): add new feature"

# 4. Push and create PR
git push -u origin HEAD
gh pr create --fill

# 5. Wait for checks
gh pr checks <pr-number>

# 6. Merge when ready
gh pr merge <pr-number> --squash --delete-branch
```

### Hotfix Flow

Branch from updated `main` and commit exactly as in Feature Branch Flow steps 1–3, then:

```bash
# Push and create PR with label
git push -u origin HEAD
gh pr create --title "hotfix: critical fix" --label "hotfix"

# Merge only after human confirmation + green checks (no --admin/--auto)
gh pr checks <pr-number>
gh pr merge <pr-number> --squash
```

### Rebase Workflow

```bash
# Fetch latest
git fetch origin

# Rebase on main
git rebase origin/main

# Force push (only for your own branch)
git push --force-with-lease
```

## GitHub CLI Tips

### Authentication

Run `gh auth status` (already covered in Quick Push); use `gh auth login` when unauthenticated.

### PR Management

```bash
# List PRs
gh pr list

# View PR details
gh pr view <number>

# Review PR
gh pr review <number> --approve --body "LGTM"
```

## Error Handling

| Error | Solution |
|-------|----------|
| Permission denied | Check gh auth, repo access |
| Branch conflict | Rebase or merge main first |
| Actions failing | Check logs, fix locally |
| PR not mergeable | Rebase or resolve conflicts |

## d.o.EPUB Studio Specific

### Required Checks Before Merge

- [ ] All tests pass
- [ ] TypeScript types valid
- [ ] E2E tests pass
- [ ] No security vulnerabilities

### Protected Branches

- `main` requires PR + CI passing
- Use branch protection rules
- Require CODEOWNERS review

## Integration

- **cicd-pipeline**: For CI/CD configuration
- **code-review-assistant**: For PR reviews

## Quality Checklist

- [ ] gh CLI authenticated and working
- [ ] Branch protection rules understood
- [ ] Quality gates pass before push
- [ ] Commit messages follow convention
- [ ] PR description is complete
- [ ] CI/CD status monitored
- [ ] Known issues checked

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "Checks are green, so I can merge without asking." | Merging requires explicit human confirmation and `--admin`/`--auto` are forbidden (AGENTS.md Tier 1 no-automerge rule); verify with `gh pr checks <pr-number>` and merge only on the user's go-ahead. |
| "A red deploy check means my code broke the build." | `Deployment rate limited — retry in 24 hours` is the Vercel Hobby free-deployment cap (`api-deployments-free-per-day`), never code; only `Deployment has failed` warrants `npx vercel inspect <dpl> --logs`. |
| "Vercel and Pages are required checks, so they gate the merge." | Both deploy integrations are non-required (ADR-286 — only Codacy is ruleset-required); merge on required-green + not-BEHIND + zero unresolved threads, then retry deployments from the dashboard. |

## Red Flags

- [ ] Merging with `--admin`/`--auto`, or before required checks are green and the user gave the go-ahead
- [ ] More than one push per revision (re-pushes burn the Vercel Hobby deployment quota)
- [ ] PR is BEHIND/DIRTY or has unresolved review threads
- [ ] `Deployment rate limited` diagnosed as a code failure instead of quota exhaustion

## Summary

GitHub workflow automation streamlines the entire development process from local changes to merged code.
