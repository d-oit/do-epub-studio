# GOAP: Missing Implementation Remediation

Status: proposed
Date: 2026-07-14

## Goal

Find and remediate missing implementations, placeholders, skipped tests, TODO/FIXME markers, incomplete security controls, and under-tested critical flows.

## Search Targets

- `TODO`
- `FIXME`
- `HACK`
- `not implemented`
- `throw new Error(`
- `test.skip`, `it.skip`, `describe.skip`
- disabled lint or type checks
- incomplete ADR references
- placeholder route handlers
- auth, grants, signed URL, R2, D1, offline sync, EPUB parsing, reader locator, and annotation paths

## Prioritization

- Blocker: auth bypass, session revocation gap, raw R2 exposure, missing parser timeout, failing required CI, or data loss risk.
- High: critical flow without tests, skipped permission/sync/auth tests, unsafe regex on untrusted input, missing trace ID before early returns.
- Medium: incomplete non-critical feature, fragile local development workflow, missing workflow validation.
- Low: documentation cleanup, stale comments, or non-user-facing polish.

## Actions

1. Run the search targets across source, tests, scripts, workflows, and docs.
2. For each hit, verify whether it is an intentional note, a harmless test fixture, or an actual missing implementation.
3. Fix small, localized gaps immediately when touching the file.
4. For larger gaps, create issue-specific GOAP and ADR files with acceptance criteria.
5. Add or update tests for every fixed critical path.
6. Ensure every surfaced pre-existing issue is fixed or has an active GOAP + ADR follow-up.

## Acceptance Criteria

- No blocker missing implementations remain undocumented.
- All skipped or placeholder tests in auth, sync, permission, and EPUB parsing paths are either enabled or covered by a linked remediation plan.
- No new TODO/FIXME markers are introduced without an owning GOAP artifact.
- Search results are summarized with file paths and risk level in the implementation PR.

## Verification

- `./scripts/quality_gate.sh`
- targeted tests for each fixed subsystem
- `gh pr checks <PR>`
- Codacy PR scan
