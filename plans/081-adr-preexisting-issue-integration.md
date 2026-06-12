# ADR 081 — Pre-Existing Issue Integration Policy

**Date:** 2026-06-11
**Status:** Accepted

## Context

During the analysis of 18 open GitHub issues against the current codebase,
10 additional improvements were discovered that don't have dedicated issues
but need to be addressed alongside the planned work.

## Decision

Pre-existing issues found during analysis are **folded into the nearest
matching cluster** rather than creating new GitHub issues. Rationale:

1. Reduces issue sprawl and cross-reference overhead
2. These gaps are blocking factors for the parent issue's acceptance criteria
3. They share the same files and execution context
4. Fixing them independently would create merge conflicts

## Policy

When an agent discovers a pre-existing issue during work:

1. If it directly relates to an open issue → fold into that issue's task list
2. If it's a new concern with no parent → create a new GOAP plan entry
3. Document in `plans/` with the improvement ID and parent reference
4. Never leave pre-existing issues for later (AGENTS.md Tier 2, rule 9)

## Consequences

- Plan 081 documents 10 improvements with clear parent-cluster mapping
- No new GitHub issues created for embedded improvements
- Each cluster's quality gate validates the embedded fix
- If a cluster is deprioritized, its embedded improvements also wait
