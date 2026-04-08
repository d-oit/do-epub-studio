---
description: Git and GitHub workflow commands
subtask: true
---

Git and GitHub workflow commands.

## Available Commands

### commit
Use `./scripts/atomic-commit/run.sh` for atomic commits with CI verification.

### git-github-workflow
Standard git workflow with GitHub integration.

## Branch Strategy

- **main**: Production-ready code only
- **feature/**: New features
- **fix/**: Bug fixes
- **refactor/**: Code refactoring

## Workflow

1. Create branch from main
2. Make changes
3. Run quality gate
4. Commit with conventional format
5. Push and create PR
6. Wait for CI
7. Squash and merge
