# ADR-096 — Merge Order Policy for Multi-Issue Swarms

- **Status:** Accepted (2026-06-15)
- **Date:** 2026-06-15
- **Deciders:** goap-agent, code-review-assistant, release-management
- **Related:** `plans/095-goap-merge-orchestration-2026-06-15.md`,
  `plans/075-goap-swarm-2026-06-15.md`,
  `plans/068-adr-open-issues-swarm-policy.md`,
  AGENTS.md TIER-1 + TIER-2.

## Context

A swarm analysis (e.g. `analysis/SWARM_ANALYSIS.md` 2026-06-15)
produces a heterogeneous set of gaps:

- Critical security fixes that must land before any UI ships.
- High-priority features that depend on the security fixes.
- Medium-priority refactors that are easier after the features.
- Documentation / governance gaps that are best done last.

Today the merge order is described **per wave inside the master
plan** (e.g. `plans/075-goap-swarm-2026-06-15.md` Wave A → D).
This works for a single orchestrator, but:

1. It is not enforceable — any contributor can merge a Wave C
   PR into a branch where Wave A is not yet on `main`.
2. It is not reviewable — reviewers do not see the order unless
   they read the master plan.
3. It is not durable — a year from now, the wave definitions
   are still in a stale plan file.
4. It does not commit to **one PR per wave**, **one branch per
   wave**, or **one tracking issue per wave** as the unit of
   delivery.

ADR-068 ("Open-Issues Swarm Policy") says every Critical/High
gap becomes a GitHub issue. It does not say how those issues
are sequenced into merges.

## Decision

We adopt the following policy for any swarm that produces
≥ 5 gaps (a "multi-issue swarm"):

1. **Waves are mandatory.** A swarm master plan MUST define
   `Wave A`, `Wave B`, `Wave C`, `Wave D` (or more) in priority
   order. Waves are sequenced Critical → High → Medium → Docs.
2. **One PR per wave.** Every wave ships as a single PR. A
   wave's PR contains every gap in that wave as one or more
   atomic commits.
3. **One branch per wave.** Branches are named
   `wave-<letter>-<short-slug>` and live until the PR merges.
   The swarm master plan may live on a separate
   `swarm-analysis-<date>` branch (plans + ADRs only).
4. **One tracking issue per wave.** Each wave has a tracking
   issue whose body is a checklist of the gaps it closes plus
   the quality gate. The tracking issue is closed when the
   wave PR merges.
5. **No out-of-order merges.** A wave PR cannot be merged while
   the previous wave's PR is unmerged. CI must be green on
   `main` after each wave.
6. **Per-wave quality gate.** Defined in the swarm master plan
   and re-stated in the wave tracking issue. Must include:
   - `./scripts/minimal_quality_gate.sh`
   - `./scripts/quality_gate.sh`
   - `./scripts/validate-workflows.sh`
   - Coverage thresholds per AGENTS.md
   - Codacy no-new-issues
7. **Atomic commits inside the wave PR.** Each commit is
   independently runnable. Commit subjects follow AGENTS.md
   TIER-2 rule 4 (`type(scope): description`, max 72 chars).
8. **Rollback is the merge revert.** No force-push to a wave
   branch after review; squash is preferred.
9. **Stale "this week" / "next sprint" language is forbidden.**
   Wave labels carry a concrete calendar reference
   (e.g. "week of 2026-06-22") determined at plan-write time.
10. **Every wave is captured in `plans/<NNN>-goap-…`.** A new
    GOAP plan (`<NNN>-goap-merge-orchestration-<date>.md`)
    describes the wave ordering, branches, commits, and
    tracking issues. This is the only file that may carry
    the words "merge orchestration" for a given swarm.

## Consequences

### Positive

- Reviewers can read one file (`plans/<NNN>-goap-merge-orchestration-…md`)
  to learn the entire delivery plan.
- The order is enforceable: a CI guard or CODEOWNERS rule can
  refuse to merge Wave C while Wave A is unmerged.
- Each wave is a unit of accountability: one PR, one tracking
  issue, one review thread.
- Future contributors reading the history can reconstruct
  the delivery sequence from the merge graph.

### Negative

- More ceremony per swarm (4 tracking issues, 4 PRs, 4 branches
  for 12 gaps instead of 12 PRs).
- The orchestrator must explicitly number the waves and label
  the issues; this is one more step at the start of a swarm.

### Neutral

- Single-issue swarms (≤ 4 gaps) are not affected; they ship
  one PR per gap as before.
- This ADR does not change the per-gap workflow defined in
  `plans/068-adr-open-issues-swarm-policy.md`.

## Compliance

- [x] `plans/095-goap-merge-orchestration-2026-06-15.md` exists
      and follows this policy.
- [x] `analysis/SWARM_ANALYSIS.md` (2026-06-15) gaps #531–#546
      are grouped into Waves A–D.
- [x] `plans/075-goap-swarm-2026-06-15.md` wave labels now carry
      concrete calendar references (week of 2026-06-15, etc.).
- [x] `plans/ADR-INDEX.md` lists ADR-096.
- [ ] Wave A tracking issue opened, Wave B/C/D tracking issues
      opened (in this PR).
- [ ] Wave A PR merged with CI green, before Wave B is opened
      (in subsequent PRs).

## Reference

- `plans/068-adr-open-issues-swarm-policy.md` — predecessor;
  the per-gap policy.
- `plans/075-goap-swarm-2026-06-15.md` — first swarm to use
  this policy.
- `plans/095-goap-merge-orchestration-2026-06-15.md` — first
  merge-orchestration plan to follow this policy.
- AGENTS.md TIER-2 rule 4 (commit message format) and
  TIER-2 rule 5 (no ignored lint/test failures).
