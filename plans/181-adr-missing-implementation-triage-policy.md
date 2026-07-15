# ADR: Missing Implementation Triage Policy

Status: Proposed  
Date: 2026-07-14

## Context

The repository rules require surfaced issues to be fixed or documented as GOAP plans plus ADRs. Missing implementations are risky because placeholders, skipped tests, and incomplete guards can hide security or data-loss defects.

## Decision

Treat missing implementation markers as audit findings until proven harmless. Every marker must be classified, fixed, or linked to an active GOAP plan and ADR.

## Required Classification

- Blocker for auth, permissions, signed URLs, session revocation, R2 exposure, parser timeout, annotation anchoring, CI, or data loss.
- High for shipped behavior gaps or missing tests in user-visible flows.
- Medium for incomplete internal ergonomics or non-critical feature seams.
- Low only when no runtime behavior, security posture, or CI readiness is affected.

## Consequences

- Skipped tests in critical domains are not acceptable as passive technical debt.
- Placeholder errors in shipped paths block merge.
- Documentation-only TODOs may remain only when they are classified and do not hide implementation work.

## Verification

- Detection queries in `plans/180-goap-missing-implementation-remediation.md` are rerun before finalizing the audit PR.
- Every open item has severity, owner or subsystem, and acceptance criteria.
