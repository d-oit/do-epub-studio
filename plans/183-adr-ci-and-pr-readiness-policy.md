# ADR: CI And PR Readiness Policy

Status: Proposed  
Date: 2026-07-14

## Context

Repository policy already states that failing CI, Codacy findings, lint errors, typecheck errors, and test failures block merge. The user specifically requested review of open GitHub issues and PRs and said all CI must pass.

## Decision

Treat CI pass status as a hard readiness gate for every PR. A PR is not merge-ready if required checks fail, are missing, or are pending without an explicit reason.

## Required Checks

- Workflow validation via `./scripts/validate-workflows.sh`.
- Full repository gate via `./scripts/quality_gate.sh`.
- GitHub Actions checks via `gh pr checks <PR>`.
- Codacy Static Code Analysis for PRs.
- Any route-specific performance, Lighthouse, coverage, or security checks configured as required by CI.

## Consequences

- Do not merge with failing CI.
- Do not use admin bypass to merge.
- Do not push to the wrong branch; verify local branch and PR head branch before any push.
- Failing checks that predate a change still require either a fix or active GOAP plus ADR documentation.

## Verification

- Every open PR reviewed by the audit has an explicit readiness state.
- The audit PR itself passes all required checks before merge.
