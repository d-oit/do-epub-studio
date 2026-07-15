# ADR: Agent Workflow Harness Standards

Status: Proposed  
Date: 2026-07-14

## Context

The project depends on agent-assisted development. The workflow must prevent unsafe shortcuts, direct commits to `main`, missing quality gates, incomplete issue tracking, and CI bypasses.

## Decision

Use `AGENTS.md` plus the repository scripts as the authoritative workflow harness. Agent skills provide domain-specific methods, but they do not override repository rules.

## Standards

- Load `goap-agent` for analysis, planning, and multi-step execution.
- Use domain skills when touching Cloudflare routes, auth, Turso/schema migrations, Codacy, test strategy, security, UI, or release workflows.
- Sync latest `main` before changes.
- Never commit directly to `main`.
- Run `./scripts/quality_gate.sh` before commit.
- Validate workflows via `./scripts/validate-workflows.sh`.
- Commit through `./scripts/atomic-commit/run.sh`.
- Document unresolved or large surfaced issues as GOAP plus ADR files under `plans/`.

## Consequences

- Agents must not treat plans as optional when issues are surfaced.
- A passing local lint command is insufficient if workflow validation, quality gate, Codacy, or PR checks fail.
- Skills are execution aids; `AGENTS.md` remains the single source of truth.

## Verification

- Harness audit in `plans/184-goap-agent-workflow-harness-audit.md` is completed.
- Any workflow gap is either fixed or tracked by an active GOAP and ADR.
