# ADR 072: Open PR and Issue Triage Policy

**Date**: 2026-06-10
**Status**: Active
**Deciders**: Engineering automation

## Context

The repository has multiple open PRs and issues spanning security hardening, CI/CD maintenance, developer-experience scaffolding, and Dependabot updates. Several PRs have failing checks, while others are clean but unmerged.

## Decision

Resolve work in this order:

1. P0: security-sensitive PR #440 must pass local validation and external checks before merge consideration.
2. P1: clean PRs #458 and #471 are treated as implementation carriers for open issues #442-#454 and commit-body DX hardening.
3. P1: Dependabot PRs #460-#466 are triaged by failing check root cause. Only minimal validated fixes should be applied; otherwise defer to Dependabot/maintainer workflow.

## Consequences

- Security fixes receive priority over DX or dependency maintenance.
- Dependabot-owned branches are not edited without a concrete, validated fix.
- Open issues can be considered addressed when a clean PR implements the requested change and passes quality gates.

## Compliance

- No direct changes to `main`.
- No secrets or credentials added.
- All implemented changes must pass applicable quality gates.
