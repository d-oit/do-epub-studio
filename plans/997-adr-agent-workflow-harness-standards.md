# ADR: Agent Workflow Harness Standards

Status: proposed
Date: 2026-07-14

## Context

The repository uses `AGENTS.md`, project skills, quality gates, workflow validation, and atomic commit tooling to keep AI-agent contributions safe and reviewable. These controls only work if instructions and scripts remain aligned.

## Decision

Treat `AGENTS.md` as the policy source of truth and scripts as the executable enforcement layer. When policy and implementation diverge, fix the script or document an ADR explaining why enforcement is intentionally different.

## Standards

- Multi-step analysis uses `goap-agent`.
- Auth and access work uses `secure-invite-and-access`.
- Worker route work uses `cloudflare-worker-api`.
- Turso or SQLite migration work uses `turso-schema-migrations`.
- PR static analysis uses `codacy`.
- Test execution and failure triage uses `test-runner` or `testing-strategy`.
- Security-sensitive review uses `security-code-auditor`.
- Commits use `./scripts/atomic-commit/run.sh` and valid conventional messages.

## Consequences

- Agents should not rely on ad hoc manual workflow steps when a harness script exists.
- New workflow requirements need both documentation and executable validation.
- PR reviews can use this ADR to decide whether an agent contribution followed repository standards.

## Verification

- Review `AGENTS.md` and script behavior together during workflow changes.
- Run workflow validation and quality gate before commit.
- Confirm PR checks and Codacy pass before merge.
