# GOAP: Agent Workflow And Harness Audit

Status: proposed
Date: 2026-07-14

## Goal

Verify that agent instructions, skills, scripts, quality gates, GitHub workflows, and commit harnesses form a coherent coding workflow for this repository.

## Scope

- `AGENTS.md`
- `.agents/skills/`
- `.github/workflows/`
- `scripts/quality_gate.sh`
- `scripts/minimal_quality_gate.sh`
- `scripts/validate-workflows.sh`
- `scripts/atomic-commit/run.sh`
- PR and security documentation

## Actions

1. Confirm `AGENTS.md` critical rules are reflected in scripts and workflows.
2. Confirm workflow validation includes actionlint and security scanning as documented.
3. Confirm quality gate covers lint, typecheck, tests, and design checks as documented.
4. Confirm atomic commit script validates commit format and does not bypass hooks.
5. Confirm skills are available for Cloudflare, auth, Turso, Codacy, testing, and security workflows.
6. Identify contradictions between instructions and scripts.
7. Propose harness improvements for any missing guardrail.

## Acceptance Criteria

- Agent instructions and executable scripts agree on required gates.
- Every required skill dependency has a documented trigger and expected use.
- Workflow validation is reproducible from a fresh checkout.
- Any unsafe or ambiguous command is documented with a remediation plan.

## Verification

- `./scripts/validate-workflows.sh`
- `./scripts/quality_gate.sh`
- `./scripts/atomic-commit/run.sh --message "docs(plans): add platform audit recommendations"`
