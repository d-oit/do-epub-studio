# ADR: Adopt Agent Harness Improvements Incrementally

Date: 2026-05-17

## Status

Accepted

## Context

`d-o-hub/github-template-ai-agents` provides a broad template for AI-assisted repositories. d.o.EPUB Studio already has stricter domain-specific requirements for auth, EPUB anchoring, regex safety, trace IDs, release governance, and quality gates.

The template is valuable as a reference, but wholesale import would add duplicated scripts, overlapping skills, and generic workflows that could conflict with existing project policy.

## Decision

Adopt template capabilities incrementally when they strengthen existing d.o.EPUB Studio workflows:

- Prefer adapting scripts over copying them unchanged.
- Preserve `AGENTS.md` as the source of policy truth.
- Keep d.o.EPUB Studio domain skills canonical.
- Add new blocking checks only after a report-only phase.
- Route all warning and gap documentation through `plans/`.

## Consequences

Positive:

- Better enforcement of existing standards such as file-size limits and skill quality.
- Improved command/documentation drift detection.
- Stronger GitHub project hygiene through labels, issue templates, and branch-protection fixtures.

Negative:

- More workflow code to maintain.
- More CI surface area that can fail independently of product code.
- Requires careful migration to avoid duplicating existing scripts.

## Implementation Notes

The first implementation should target low-risk, high-signal checks:

1. LOC gate.
2. Skill eval runner.
3. Command verification in report-only mode.
4. GitHub metadata automation.
