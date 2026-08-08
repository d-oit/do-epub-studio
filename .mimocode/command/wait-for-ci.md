---
name: wait-for-ci
description: Poll GitHub CI checks on a PR until all jobs complete, with auto-detection of failures
triggers:
  - wait for CI
  - check CI status
  - poll checks
  - wait for checks
  - ci status
  - are checks passing
params:
  - name: timeout
    description: "Max seconds to wait (default: 1800 = 30min)"
    default: 1800
  - name: interval
    description: "Seconds between polls (default: 60)"
    default: 60
---

# Wait for CI Checks

Poll `gh pr checks` on a PR until all jobs finish. Auto-detects failures and
reports which checks failed.

## Step 1 — Identify the PR

```bash
# From current branch
PR_NUMBER=$(gh pr view --json number --jq '.number')

# Or use provided number
PR_NUMBER=<number>

# Timeout (seconds) — default 1800 (30 min), override with: --timeout 3600
TIMEOUT=${TIMEOUT:-1800}
INTERVAL=${INTERVAL:-60}
MAX_ATTEMPTS=$(( TIMEOUT / INTERVAL ))
```

## Step 2 — Initial Check

```bash
gh pr checks "$PR_NUMBER"
```

If all checks show ✅, you're done. If any show ❌, investigate failures
(see Step 4). If checks are still ⏳, proceed to polling.

## Step 3 — Poll Loop

```bash
# Uses $INTERVAL and $MAX_ATTEMPTS from Step 1
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo "[$(date +%H:%M:%S)] Poll $ATTEMPT/$MAX_ATTEMPTS..."

  # Check if all jobs completed (no pending/in-progress)
  PENDING=$(gh pr checks "$PR_NUMBER" 2>/dev/null | grep -cE '(pending|in_progress|queued|expected)' || true)

  if [ "$PENDING" -eq 0 ]; then
    echo "All checks completed."
    gh pr checks "$PR_NUMBER"
    break
  fi

  echo "  $PENDING check(s) still running. Waiting ${INTERVAL}s..."
  sleep "$INTERVAL"
done

if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
  echo "TIMEOUT: Checks did not complete within $((MAX_ATTEMPTS * INTERVAL))s."
  gh pr checks "$PR_NUMBER"
  exit 1
fi
```

## Step 4 — Analyze Failures

If any checks failed:

```bash
# Get the failing run ID
RUN_ID=$(gh run list --branch $(git branch --show-current) --status failure --json databaseId --jq '.[0].databaseId')

# View failed jobs
gh run view "$RUN_ID" --json jobs --jq '.jobs[] | select(.conclusion=="failure") | .name'

# Get failure logs (last 50 lines)
gh run view "$RUN_ID" --log-failed 2>/dev/null | tail -50
```

## Step 5 — Common Failure Patterns

| Check | Likely Cause | Fix |
|-------|-------------|-----|
| Pre-commit Hooks | lint/commitlint/format | Run `./scripts/quality_gate.sh` locally |
| Unit Tests | test failure | Run `pnpm run test` locally |
| Build (Node 22) | TypeScript/bundle error | Run `pnpm --filter web build` |
| Codacy | code quality issue | Check `codacy pull-request gh <org> <repo> <pr>` |
| Lint PR title | commitlint format | Fix PR title to `type(scope): description` |

## Step 6 — After Fixes

```bash
# Push fixes
git add -A
./scripts/atomic-commit/run.sh --message "fix(scope): description" --body "Why"
git push

# Re-poll
# Repeat from Step 2
```

## Quick Reference

```bash
# One-liner: wait for specific PR
PR=599; while gh pr checks $PR 2>/dev/null | grep -qE '(pending|in_progress|queued)'; do sleep 60; done; gh pr checks $PR

# Watch mode (blocks until done)
gh pr checks $PR --watch

# Get just the summary line
gh pr checks $PR 2>/dev/null | tail -1
```

## Notes

- `gh pr checks --watch` blocks but doesn't give granular progress — the poll
  loop above gives attempt-by-attempt feedback.
- Default timeout is 30 minutes. Override with `TIMEOUT=3600` for longer CI
  pipelines (e.g., E2E + build + Codacy can take 20+ min).
- `INTERVAL` controls poll frequency; lower values give faster feedback but
  hit the GitHub API more often.
- This command is for **polling only** — use `github-pr-autopilot` for full
  PR lifecycle automation (merge, rebase, conflict resolution).
