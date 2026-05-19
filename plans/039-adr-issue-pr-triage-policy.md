# ADR 039: Issue & PR Triage Policy

**Date:** 2026-05-19
**Status:** Accepted
**Companion to:** Plan 038 (GOAP — Backlog Triage)

## Context

The repository accumulated 17 open issues and 4 open PRs since Plan 033's gap analysis closed (2026-05-17). Per AGENTS.md Tier 2 rule #8 ("Document ALL issues as GOAP plans + ADRs in `plans/`"), open issues and PRs must not float as ad-hoc work — they require a coordinated plan with explicit policy.

Direct edits to `agents-docs/KNOWN-ISSUES.md` are forbidden by Tier 2 rule #8; that file mirrors monitor-tier items only. The authoritative tracking surface is `plans/`.

Two prior plans (036 + 037) cover agent harness improvements but do not address product-level backlog hygiene; they were authored in parallel and remain orthogonal.

## Decision

1. **Single coordination plan per triage cycle.** Plan 038 is the canonical work-coordination doc for all currently-open issues and PRs. Future triage cycles spawn a new sequential plan ID, never edit 038 in place.
2. **GOAP waves, not flat lists.** Backlog work is grouped into waves with explicit gates between them (see Plan 038 §3). No issue is "in progress" without a wave assignment.
3. **PR reconciliation precedes new issue work.** Open PRs targeting issues in the backlog are merged or closed before that issue is re-assigned, to avoid duplicate effort.
4. **Releases gated through `release-management` skill.** No manual `git tag` or `gh release create` invocations, ever — per AGENTS.md Tier 2 #10. Triage plans that close out a release window must explicitly call the skill.
5. **In-code TODO/FIXME markers must reference an open GitHub issue.** Sentinel constants (e.g. i18n parity guards) are exempt and must be commented as such.
6. **Per-group skill assignment is required.** Each issue group in a triage plan declares which skill(s) own execution, ensuring Tier 2 rule #7 (`goap-agent` for analysis/planning) propagates to downstream agents.
7. **Acceptance threshold is cluster-level, not item-level.** Triage plans complete when ≥ 80% of items per group close, with explicit deferral rationale for the rest. This prevents the "one stuck issue blocks the whole wave" anti-pattern.

## Consequences

**Positive**

- Open-issue churn becomes visible through plan history (`ls plans/`) rather than buried in GitHub.
- Future agents inherit a clear template for backlog triage.
- Release governance (Plan 035) and CI hygiene (Group A of Plan 038) cannot silently drift.
- AGENTS.md compliance is enforceable: each open issue/PR maps to a plan entry.

**Negative**

- Adds a documentation step before any issue work starts.
- Triage plans grow over time; archival policy may be needed past plan ~100.
- Cluster-level acceptance can mask a small number of permanently-deferred items; mitigated by explicit deferral notes in §7 of each triage plan.

## Implementation Notes

- This ADR governs Plan 038 immediately.
- Subsequent triage cycles should be filed as `plans/NNN-goap-backlog-triage-YYYY-MM-DD.md` with a sibling ADR only when new policy emerges; otherwise they reference this ADR.
- The `release-management` skill should be the single executor for the Wave 1 `v0.1.0` cut.
- `learn` skill should capture any deferral rationale that recurs across cycles (e.g., infrastructure dependencies).

## References

- AGENTS.md Tier 2 rules #7, #8, #10
- Plan 033 — comprehensive gap analysis (predecessor pattern)
- Plan 035 — release governance ADR
- Plan 038 — current triage cycle
