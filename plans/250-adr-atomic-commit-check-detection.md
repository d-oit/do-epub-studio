# ADR-250: Atomic Commit Check Detection Uses Supported CLI Fields

**Date:** Current session
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** ADR-083, ADR-187, GOAP-250

## Context

The atomic commit verifier requested `conclusion` and `status` from
`gh pr checks --json`. The installed GitHub CLI does not expose those fields
for that command, so the request failed and the verifier converted the error to
an empty check list. A PR with successful checks was therefore reported as
having no checks and rolled back after the grace period.

## Decision

`scripts/atomic-commit/verify.sh` must query only fields supported by
`gh pr checks --json`: `name`, `state`, and `bucket`. The `bucket` value is the
primary classification:

- `pending` keeps verification open.
- `fail` fails verification immediately.
- `pass` and `skipping` count as completed non-failing checks.
- Unknown buckets fail closed, except for explicitly recognized successful
  states (`SUCCESS`, `NEUTRAL`, and `SKIPPED`).

The verifier must continue requiring at least one check and retain its timeout
and no-check grace period. This preserves fail-closed behavior without treating
CLI schema incompatibility as missing CI.

## Consequences

- Atomic commit verification works with the repository's installed `gh` CLI.
- Skipped jobs are represented accurately without requiring GraphQL-only fields.
- Future CLI bucket values cannot silently pass verification.
- The verifier's parsing contract is documented for future CLI upgrades.
