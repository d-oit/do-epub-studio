# GOAP: Missing Implementation Remediation

Status: ✅ COMPLETED (via Plans 186-196)
Date: 2026-07-14

## Goal

Find and triage missing implementation, placeholders, skipped tests, incomplete security controls, and workflow gaps across the repository.

## Search Scope

- Source and tests: `*.ts`, `*.tsx`, `*.js`.
- Documentation and plans: `*.md`.
- CI and harness scripts: `.github/workflows/`, `scripts/`, `.agents/skills/`, `AGENTS.md`.
- Critical domains: auth, grants, sessions, signed URLs, EPUB parsing, offline sync, annotations, reader UI, Worker request handling, schema migrations, and CI gates.

## Detection Queries

- `TODO`
- `FIXME`
- `HACK`
- `not implemented`
- `NotImplemented`
- `throw new Error(`
- `.skip(`
- `describe.skip`
- `it.skip`
- `test.skip`
- `pending`

## Triage Policy

- Blocker: security, auth, permission, data loss, unavailable core feature, or failing required CI.
- High: shipped behavior gap, missing critical-flow tests, Cloudflare best-practice violation, or Codacy finding.
- Medium: incomplete non-critical feature, incomplete documentation, or local development weakness.
- Low: cleanup, clarity, or future refactor with no current user impact.

## Actions

1. Run the detection queries and capture every result with file path and line number.
2. Exclude false positives only with explicit rationale.
3. Fix small issues in the same changeset when they are in touched files.
4. For larger items, create or link a GOAP plan plus ADR before merge.
5. Add missing tests for any auth, permission, sync, signed URL, parser timeout, or annotation-locator issue.
6. Ensure no skipped critical-flow tests remain without a linked active remediation plan.

## Acceptance Criteria

- All missing-implementation markers are classified.
- Any blocker or high-severity issue is fixed or tracked with an active GOAP and ADR.
- Critical security and data-flow gaps are not deferred without explicit policy.
- `./scripts/quality_gate.sh` passes before commit.
