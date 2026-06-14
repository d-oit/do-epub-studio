# Jules CLI Quick Reference

Concise command reference for delegating coding work to Jules sessions.

## Authentication

| Command | Description |
|---------|-------------|
| `jules login` | Authenticate with Google (one-time). |
| `jules logout` | Sign out and clear local auth. |
| `jules whoami` | Show current authenticated account. |

## Session management

| Command | Description |
|---------|-------------|
| `jules remote new --repo <owner/repo> --session "<prompt>"` | Start a new session against a specific repo. |
| `jules remote new --session "<prompt>"` | Start a session; auto-detects repo from `git remote get-url origin`. |
| `jules remote list --session` | List all sessions with status (Completed/Running/Failed). |
| `jules remote list --repo` | List connected repos. |
| `jules remote pull --session <id>` | Pull the session's branch into the current local branch. |
| `jules remote show --session <id>` | Show details (diff stats, prompt, plan) for a session. |

## Interactive

| Command | Description |
|---------|-------------|
| `jules` | Launch the TUI for visual review. |
| `jules completion <bash\|zsh>` | Emit shell completion script. |

## Common patterns

### In-repo delegation

```bash
# Ensure on a clean working tree
git status --porcelain

# Delegate
jules remote new --session "Refactor the Worker file route to use shared DTOs"

# Watch
jules remote list --session
```

### Pull + normalize + push (mandatory for bot commits)

```bash
jules remote pull --session <id>

BASE="$(git merge-base HEAD origin/main)"
HEAD="$(git rev-parse HEAD)"

./.agents/skills/jules-delegator/scripts/normalize-commits.sh \
  --from "$BASE" --to "$HEAD" --type feat --scope reader

./scripts/validate-commit-message.sh <(git log -1 --pretty=%B)
git push --force-with-lease origin <branch>
```

## Status states

| Status | Meaning |
|--------|---------|
| Queued | Session created, not yet running. |
| Running | Jules is actively working. |
| AwaitingPlanApproval | Jules proposed a plan; you may need to approve in the TUI. |
| Completed | Session finished; safe to pull. |
| Failed | Jules could not complete the task; check logs in TUI. |

## Notes

- The CLI is `@google/jules` on npm.
- Session branches are disposable; rewrite history freely.
- Bot commits are non-conventional by design — always run `normalize-commits.sh`.
- See `SKILL.md` in this folder for the full workflow and rationale.
