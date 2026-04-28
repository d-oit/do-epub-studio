do-epub-studio/.agents/skills/github-workflow/SKILL.md
```

```markdown
---
version: "1.0.0"
name: github-workflow
description: >
  Complete GitHub workflow automation - push, create branch/PR, monitor Actions
  with pre-existing issue detection, auto-merge/rebase when checks pass. Handles
  the full git→GitHub→merge lifecycle.
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

### 1. Quick Push

```bash
# Stage, commit, and push in one command
gh auth status
git add -A
git commit -m "type(scope): description"
git push -u origin HEAD
```

### 2. Branch + PR Creation

```bash
# Create branch from current state
gh branch create feature/my-feature

# Or create PR directly
gh pr create --title "feat(scope): description" --body "Description"
```

### 3. Monitor Actions

```bash
# List recent workflow runs
gh run list --limit 10

# Watch specific run
gh run watch <run-id>

# Get run status
gh run view <run-id> --log
```

### 4. Auto-Merge Workflow

```bash
# Enable auto-merge
gh pr merge <pr-number> --admin --auto

# Or use PR dashboard
gh pr view <pr-number> --json state,mergeable,reviews
```

## Pre-Existing Issue Detection

### Detect Before Push

Always check for known issues in the repository:

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

## Common Patterns

### Feature Branch Flow

```bash
# 1. Update main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/my-feature

# 3. Work and commit
# ... make changes ...
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

```bash
# 1. Create hotfix from main
git checkout main
git pull
git checkout -b hotfix/critical-fix

# 2. Fix and commit
git add -A
git commit -m "fix(scope): critical fix"

# 3. Push with priority
git push -u origin HEAD

# 4. Create PR with label
gh pr create --title "hotfix: critical fix" --label "hotfix"

# 5. Auto-merge if approved
gh pr merge <pr-number> --admin --auto
```

### Rebase Workflow

```bash
# Fetch latest
git fetch origin

# Rebase on main
git rebase origin/main

# Force push (only for your own branch)
git push --force-with-lease

# Verify PR updated
gh pr view <pr-number> --json commits
```

## GitHub CLI Tips

### Authentication

```bash
# Check status
gh auth status

# Login
gh auth login

# Switch accounts
gh auth refresh
```

### PR Management

```bash
# List PRs
gh pr list

# View PR details
gh pr view <number>

# Review PR
gh pr review <number> --approve --body "LGTM"

# Comment on PR
gh pr comment <number> --body "Comment"
```

### Issue Management

```bash
# Create issue
gh issue create --title "Bug" --body "Description"

# List issues
gh issue list

# Close issue
gh issue close <number>
```

## Error Handling

| Error | Solution |
|-------|----------|
| Permission denied | Check gh auth, repo access |
| Branch conflict | Rebase or merge main first |
| Actions failing | Check logs, fix locally |
| Auto-merge disabled | Enable in repo settings |
| PR not mergeable | Rebase or resolve conflicts |

## EPUB Studio Specific

### Required Checks Before Merge

- [ ] All tests pass
- [ ] TypeScript types valid
- [ ] E2E tests pass
- [ ] No security vulnerabilities
- [ ] Documentation updated if needed

### Protected Branches

- `main` requires PR + CI passing
- Use branch protection rules
- Require CODEOWNERS review

## Integration

- **atomic-commit**: For commit workflow
- **cicd-pipeline**: For CI/CD configuration
- **code-review-assistant**: For PR reviews
- **github-readme**: For documentation

## Quality Checklist

- [ ] gh CLI authenticated and working
- [ ] Branch protection rules understood
- [ ] Quality gates pass before push
- [ ] Commit messages follow convention
- [ ] PR description is complete
- [ ] CI/CD status monitored
- [ ] Known issues checked

## Summary

GitHub workflow automation streamlines the entire development process from local changes to merged code. Always verify quality gates pass before push and monitor CI status after.