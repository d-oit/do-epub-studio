---
description: Execute atomic commit workflow - validate, commit, push, create PR, and verify CI passes
subtask: false
---

# Execute atomic commit workflow

## Workflow Steps

1. **Validate** - Run quality gate (`./scripts/quality_gate.sh`)
2. **Branch** - Create feature branch if on main
3. **Commit** - Stage and commit all changes
4. **Push** - Push to remote
5. **PR** - Create a PR (if applicable)
6. **Verify** - Monitor CI until all checks pass

## Key Principles

- **Atomic commits** - One logical change per commit
- **Verify before push** - Quality gate must pass
- **Push immediately** - After successful commit
- **PR creation** - For non-main branches

## Usage

Run directly without arguments - the workflow handles staging and commit message:

```bash
# This will prompt for commit message
./scripts/atomic-commit/run.sh
```

## Prerequisites

- Ensure all tests pass
- No lint or type errors
- Build succeeds
- All skills validated

## CI Verification

After push, monitor GitHub Actions:

- CI workflow must pass
- All jobs must succeed
- Report any failures immediately
