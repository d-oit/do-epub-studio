# GOAP-250: Restore Atomic Commit CI Check Detection

**Date:** Current session
**Status:** COMPLETED
**Related:** ADR-250

## Problem

The required atomic commit workflow treated successful PR checks as absent
because `gh pr checks --json conclusion,status` is invalid for the installed
GitHub CLI. The command error was swallowed by `verify.sh`, causing a good PR
to be closed and rolled back after the no-check grace period.

## Execution

1. **Analyze:** Reproduced the verifier failure against closed PR #1011; the
   CLI reported `Unknown JSON field: "conclusion"` while the PR had successful
   CI, Cloudflare Pages, Codacy, Lighthouse, and visual-regression checks.
2. **Decompose:** Separate the CLI field contract, bucket classification, and
   fail-closed fallback behavior.
3. **Strategize:** Use the supported `name`, `state`, and `bucket` fields, count
   `pending` as incomplete, `fail` as failed, and `pass`/`skipping` as complete.
4. **Execute:** Update `scripts/atomic-commit/verify.sh` and document ADR-250.
5. **Verify:** Run ShellCheck, the repository quality gate, and a real verifier
   run against a PR with completed checks before relying on the workflow again.

## Acceptance criteria

- The verifier no longer requests unsupported JSON fields.
- Successful and skipped checks complete verification.
- Pending checks remain pending.
- Failed or unknown check buckets fail closed.
- The regression and its remediation are documented in `plans/`.
