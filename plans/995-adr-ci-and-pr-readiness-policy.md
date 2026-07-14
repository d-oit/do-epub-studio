# ADR: CI And Pull Request Readiness Policy

Status: proposed
Date: 2026-07-14

## Context

The repository requires all CI checks to pass before merge, including Codacy Static Code Analysis. Local lint is not sufficient because root-level configuration files may be analyzed by Codacy even when local ESLint does not cover them.

## Decision

PR readiness requires all required GitHub checks, workflow validation, full quality gate, and Codacy PR analysis to pass. Failing checks must be investigated instead of dismissed as pre-existing.

## Required Gates

- `./scripts/validate-workflows.sh`
- `./scripts/quality_gate.sh`
- `codacy pull-request gh d-oit do-epub-studio <PR> --output json`
- `gh pr checks <PR>`
- atomic commit script with a valid conventional commit message

## Consequences

- A PR cannot be merge-ready while any required check is failing.
- If a failure exists on `main`, it is still a repository issue and must be fixed or documented with active GOAP + ADR follow-up.
- No administrative bypass or failing-check merge is acceptable.

## Verification

- Re-run `gh pr checks <PR>` after each push.
- Confirm Codacy result after the latest commit SHA is analyzed.
- Confirm branch name matches PR head before pushing.
