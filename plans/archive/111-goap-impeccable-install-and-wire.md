# GOAP 111 — Impeccable Install & Wire (One-Time Setup Swarm)

**Date:** 2026-06-24
**Status:** ✅ COMPLETED (setup resolved by PR #650 and Plan 112)
**Author:** Codebase analysis session 2026-06-24
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Related ADR:** `plans/111-adr-impeccable-design-vocabulary.md`

## Goal

Install Impeccable design skill for all providers, wire it into the CI quality gate, create project design docs (`PRODUCT.md`, `DESIGN.md`), and rewire existing skills to reference Impeccable commands.

## Tasks

| Task | Scope | PR | Status |
|------|-------|----|----|
| T1 | Git submodule + link providers + CI gate + AGENTS.md | PR 0b (`chore/impeccable-install`) | PENDING |
| T2 | `PRODUCT.md` + `DESIGN.md` + ADR-111 | PR 0c (`docs/impeccable-init`) | THIS PR |
| T3 | Rewire 5 skills (reader-ui-ux, anti-ai-slop, accessibility-auditor, code-quality, codacy) | PR 0d (`docs/skills-impeccable-integration`) | PENDING |
| T4 | Update `plans/ADR-INDEX.md` with ADR-111 | PR 0c (included) | THIS PR |

## Quality gates
- Each PR passes `./scripts/quality_gate.sh`
- SKILL.md edits stay under `MAX_LINES_PER_SKILL_MD=250`
- `AGENTS.md` stays at `MAX_LINES_AGENTS_MD=150`

## Synthesize
- Impeccable installed and wired
- Design vocabulary documented
- Skills reference Impeccable commands
- One-time setup complete; subsequent PRs use Impeccable in workflow
