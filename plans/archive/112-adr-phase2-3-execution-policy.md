# ADR-112: Phase 2/3 Execution & CI Hardening Policy

**Date:** 2026-06-24
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** ADR-052 (Gap Closure), ADR-068 (Open-Issues Swarm), ADR-072 (Open PR/Issue Triage), ADR-077 (Phased Feature Delivery), ADR-083 (ADR Numbering), ADR-087 (CI Failure Resolution), ADR-096 (Merge Order), ADR-105 (UI Platform Modernization), ADR-106 (Feature Completeness), ADR-107 (Quality/DX), ADR-110 (Backlog Consolidation), ADR-111 (Impeccable)

## Context

Plan 110 verified that Phase 1 P1 items (V1–V6) shipped in PRs #638–#642
on 2026-06-24. The remaining work — Phase 2 platform modernization (V7–V12)
plus all Phase 3 polish (15+ items across plans 105, 106, 107) — is a
large backlog that risks drift if not executed under a single tracker.

Impeccable is installed (PRs #635–#637) but `scripts/run-impeccable.sh`
is not yet wired into the default `./scripts/quality_gate.sh`; bundle
budget enforcement is described in ADR-107 but not enforced in CI;
markdownlint + zizmor validation exist as scripts but are not in the
default gate either. Phase 4 closes this gap.

## Decision

1. **One execution tracker.** Plan 112 is the single, prioritized,
   re-verified tracker for Phase 2 + Phase 3 + Phase 4. The older plans
   (105, 106, 107, 110) remain as detailed evidence records.

2. **Per-PR, per-skill assignment.** Each task has a designated skill
   (e.g. V7 → `cloudflare-worker-api` + `reader-ui-ux`; V9 → `reader-ui-ux`;
   B3/B5 → `security-code-auditor`; F1/F2 → `code-quality`; E6/E7 → `cicd-pipeline`).
   Subagents invoked with the skill reference in the prompt.

3. **Sequential per-PR, parallel across branches.** A task does not move
   to the next critical task until its PR's `gh pr checks` shows green.
   Independent tasks run in parallel branches and merge in dependency
   order.

4. **AGENTS.md TIER-1 pre-existing-issue mandate is enforced.** Any
   pre-existing CI failure surfaced during a PR's run is fixed in the
   same PR, or a follow-up GOAP plan + ADR + tracking issue is opened
   and linked from the PR description (no deferral without follow-up).

5. **Codacy + Impeccable become default gate checks.** Phase 4 adds
   `scripts/run-impeccable.sh` and bundle-size budget enforcement to
   the quality gate. Impeccable findings are `::warning::` by default;
   `IMPECCABLE_REQUIRED=1` opt-in for stricter PRs.

6. **No `--admin` merge, no merging with any failing check.** AGENTS.md
   TIER-1 forbids this. If a check fails, fix it; if it cannot be fixed,
   document in `KNOWN-ISSUES.md` (monitor-tier) per AGENTS.md T2.8.

7. **Status hygiene.** Plans 105, 106, 107, 110 receive a one-line
   pointer to plan 112 in their Status field when this ADR is accepted.

## Consequences

### Positive

- One authoritative answer to "what is left to build" (plan 112 table).
- Phase 4 closes the loop on CI hardening (impeccable + bundle budget).
- Pre-existing issues cannot silently accumulate (TIER-1 mandate).
- Skill assignments are explicit, so subagent prompts are deterministic.

### Negative / costs

- 24+ independent PRs is a large merge surface; risk of conflicts.
- Impeccable detector may over-flag pre-existing UI; mitigated by
  `ignoreValues` / `ignoreFiles` in `.impeccable/config.json`.
- Phase 4 gate changes can fail other PRs; mitigated by `::warning::`
  default and per-PR opt-in.

## Compliance

- AGENTS.md TIER-1, TIER-2 (rules 1, 2, 7, 8).
- ADR-083 — `112` is the next free ADR number after `111`.
- ADR-096 — multi-PR merge order via dependency graph.
