# ADR-068: Open-Issues Swarm Policy

> **Status:** Accepted (2026-06-15, retroactively confirmed)
> **Supersedes:** none
> **Related:** `plans/068-goap-swarm-open-issues-2026-06-06.md`,
> `llms-full.txt:97`
> **Deciders:** maintainers
> **Tags:** governance, swarm, issues

## Context

The 2026-06-06 swarm open-issues PR
(`plans/068-goap-swarm-open-issues-2026-06-06.md`) referenced a
companion ADR-068 ("Open-issues swarm policy") that was never
created. The `llms-full.txt:97` file lists "ADR-068: Open-issues
swarm policy (this batch)" as a current policy. The file
itself was missing on disk.

This ADR fills that gap. It states the policy the swarm was
already following and makes it a load-bearing, citable document.

## Decision

### Policy

The "swarm open-issues" pattern — used by the 2026-04, 2026-05,
2026-06 swarms — follows these rules:

1. **Trigger.** A swarm analysis is initiated when (a) the
   monthly maintainer cadence calls for it, (b) a single large
   PR surfaces >5 cross-cutting findings, or (c) a major
   refactor is planned and the team needs a baseline.

2. **Methodology.** Four parallel explore agents cover:
   (1) Feature Gaps + Implementation Completeness,
   (2) Test Coverage + Documentation,
   (3) Architecture + Patterns,
   (4) Security + Quality. Each agent returns a structured
   report. The orchestrator (goap-agent) merges them, maps
   findings to gap IDs (continuing from the prior swarm's
   numbering), and writes the master report to
   `analysis/SWARM_ANALYSIS.md`.

3. **Numbering.** Gap IDs continue from the prior swarm.
   Closed gaps are recorded with `[Closed YYYY-MM]` markers.
   New gaps are appended in the order they appear in the
   cross-cutting observations.

4. **Plans + ADRs.** Per AGENTS.md TIER-2 rule 8, every
   Critical/High gap must have a paired GOAP plan + ADR. The
   plans live in `plans/0NN-goap-*.md` and the ADRs in
   `plans/0NN-adr-*.md`, with `0NN` chosen to be the next
   available number in sequence (see ADR-083 for the
   numbering rule).

5. **GitHub issues.** Every Critical/High/Medium gap is also
   opened as a GitHub issue with the standard template
   (Summary, Evidence, Why, Fix, Acceptance Criteria, Linked
   Plan, Linked ADR). The issue IDs are referenced from the
   plan.

6. **PR.** A single PR opens with the SWARM_ANALYSIS.md, the
   plan/ADR files, and the missing ADR cross-references
   resolved. The PR is the unit of traceability for the
   swarm. Individual gaps are closed by follow-up PRs that
   reference the issue + the plan.

7. **Anti-patterns.**
   - Do not edit `KNOWN-ISSUES.md` (it does not exist; the
     gap inventory is the swarm report itself).
   - Do not re-litigate resolved gaps in a new swarm; record
     their closure with evidence and move on.
   - Do not commit the swarm report to `main` directly; use
     a feature branch + PR (AGENTS.md TIER-1).

## Consequences

### Positive

- The 2026-06-06 swarm is now fully traceable.
- Future swarms have a written policy to follow.
- The `llms-full.txt:97` reference is no longer a broken link.

### Negative

- None. This is documentation only.

## Compliance

- AGENTS.md TIER-2 rule 8 — gaps are documented as GOAP plans
  and ADRs.
