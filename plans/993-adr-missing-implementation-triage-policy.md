# ADR: Missing Implementation Triage Policy

Status: proposed
Date: 2026-07-14

## Context

The repository requires surfaced issues to be fixed or documented with active GOAP and ADR follow-up. Missing implementations and skipped tests can silently become release blockers, especially in auth, sync, access control, and EPUB parsing.

## Decision

Every missing implementation marker must be classified before merge. Blocker and high-risk items must be fixed in the current change when reasonably scoped. Larger work must receive a GOAP file and an ADR with explicit acceptance criteria before the current PR is considered complete.

## Triage Rules

- Security, auth, permission, session, signed URL, R2, parser timeout, and untrusted regex gaps are blockers.
- CI failures and Codacy findings are blockers until fixed or documented with active remediation.
- Skipped tests in critical flows are blockers unless replaced by equivalent coverage.
- Documentation-only TODOs are low risk only when they do not describe missing shipped behavior.

## Consequences

- Engineers cannot dismiss a surfaced issue as pre-existing without follow-up artifacts.
- Plans become the source of truth for deferred work.
- PR descriptions must link any new GOAP/ADR remediation artifact relevant to merge readiness.

## Verification

- Search for missing implementation markers before commit.
- Confirm every unresolved marker has a linked plan artifact.
- Confirm quality gate and PR checks pass.
