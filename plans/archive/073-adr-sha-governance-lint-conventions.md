# ADR-073: SHA Allowlist Governance and Lint Convention Directories

**Status**: Accepted
**Date**: 2026-06-10
**Context**: GOAP Plan 073

## Decision

### SHA Allowlist

When Dependabot bumps a GitHub Action to a new version, the new commit SHA must be added to `scripts/validate-shas.sh` before CI will pass. This is by design — it forces human/agent review of every external action update.

**Process**: Verify the SHA matches the tagged release on the action's repository, then add to `ALLOWED_SHAS` array.

### Lint Convention Directories

Directories following established testing/tooling conventions (`__tests__`, `__stories__`, `__mocks__`) are exempt from `unicorn/filename-case` via the `ignore` regex array. These are industry-standard patterns that predate the stricter enforcement in unicorn 65.x.

## Consequences

- Dependabot PRs will require a companion SHA update (or pre-emptive allowlisting in the unblock PR).
- New convention directories following `__name__` pattern are automatically exempt from filename-case.
