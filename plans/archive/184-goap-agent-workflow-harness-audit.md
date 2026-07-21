# GOAP: Agent Workflow Harness Audit

Status: ✅ COMPLETED (via Plans 186-196)
Date: 2026-07-14

## Goal

Verify that the coding workflow, agent skills, instructions, quality gates, and commit harness form a coherent best-practice development workflow.

## Scope

- `AGENTS.md`
- `.agents/skills/`
- `scripts/quality_gate.sh`
- `scripts/validate-workflows.sh`
- `scripts/atomic-commit/run.sh`
- `.github/workflows/`
- `plans/` GOAP and ADR conventions

## Actions

1. Verify `AGENTS.md` rules are enforceable by scripts or CI where possible.
2. Verify quality gates do not silently skip lint, typecheck, tests, workflow validation, coverage, or design/security checks.
3. Verify `atomic-commit` enforces message format and runs required validation.
4. Verify skills are mapped to actual work domains and do not contradict repository rules.
5. Verify workflow validation includes `actionlint` and `zizmor` as required.
6. Verify Codacy coverage includes root-level config files that local ESLint may not cover.
7. Identify unsafe harness behavior, undocumented bypasses, or missing preflight checks.

## Recommendations

- Keep `AGENTS.md` as the single source of truth for agent and human workflow.
- Ensure GOAP and ADR artifacts are required for deferred issues, not optional documentation.
- Prefer one documented command path for commits: `./scripts/atomic-commit/run.sh --message "type(scope): description"`.
- Treat local gates and GitHub checks as complementary; neither replaces Codacy or required remote checks.

## Acceptance Criteria

- Harness scripts align with `AGENTS.md`.
- Any contradiction is fixed or documented with a follow-up GOAP and ADR.
- New audit files are written in the existing `plans/` convention.
- Final changes pass workflow validation and quality gate.
