# ADR-111: Impeccable Design Vocabulary Adoption

**Date:** 2026-06-24
**Status:** Proposed
**Deciders:** Project maintainer
**Related:** ADR-082b (Editorial Minimalist UI Direction), ADR-063a (Accessibility Design Tokens), ADR-105 (2026 UI Platform Modernization)

## Context

The project needs a systematic, machine-checkable design quality gate to complement the existing human-review and axe-core accessibility checks. Impeccable provides 44 deterministic detector rules for AI-generated frontend anti-patterns, plus 23 slash commands for design iteration.

The project already has `anti-ai-slop` and `reader-ui-ux` skills that cover some design quality ground. Impeccable supersedes neither — it is broader (44 rules + commands) but lacks project-specific context (OKLCH tokens, ADR-082b direction, editorial minimalist aesthetic).

## Decision

1. **Install Impeccable** as a git submodule at `.impeccable/` (pinned to `cli-v3.1.0` SHA). Provider folders are symlinked via `npx impeccable link`.

2. **Wire into quality gate.** `scripts/run-impeccable.sh` runs `npx impeccable detect --json .` and writes `.impeccable/last-run.json`. The quality gate calls this script; findings are `::warning::` by default, promoted to required via `IMPECCABLE_REQUIRED=1`.

3. **Chat commands as design vocabulary.** All UI work uses `/impeccable craft`, `audit`, `polish`, `critique`, `shape`, `harden`, `adapt`, `optimize` as the shared design language between agent and codebase. Project tokens in `globals.css` remain authoritative.

4. **Skill integration.** Impeccable is referenced in `reader-ui-ux`, `anti-ai-slop`, `accessibility-auditor`, `code-quality`, and `codacy` skills. It is the deterministic backbone; project skills provide LLM critique and project-specific context.

5. **OpenCode hook gap.** OpenCode has no documented hook surface for auto-running the detector on file edits. Work-around: the CLI runs in the quality gate. Other providers (Claude, Copilot, Codex, Cursor) have hook manifests installed but not auto-enabled.

6. **Update procedure.** Bump the submodule SHA and re-run `npx impeccable link`. Documented in `DESIGN.md`.

## Consequences

### Positive
- Machine-checkable design quality (44 rules, no LLM needed)
- Shared vocabulary across all AI agents working on the project
- CI gate catches anti-patterns before merge
- Deterministic, fast, no API key required

### Negative / costs
- Submodule adds a vendored dependency to maintain
- OpenCode lacks hook support (manual quality gate step)
- 44 rules may over-flag existing UI (mitigated by `ignoreValues`/`ignoreFiles` in config)

## Compliance
- AGENTS.md TIER-1: No secrets or tokens exposed (Impeccable runs locally)
- AGENTS.md TIER-2: Quality gate integration
- ADR-083 numbering: `111` is the next free number after `110`
