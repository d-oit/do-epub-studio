# ADR-113: Phase 3 Polish Execution & Knowledge Compaction Policy

**Status:** Proposed  
**Date:** 2026-06-26  
**Deciders:** orchestrator (GOAP agent)  
**Supersedes:** ADR-112 (Phase 2/3 execution — remains active for its scope)

---

## Context

Plan 112 tracked Phase 2 (V7-V12) and Phase 4 (CI hardening). Phase 3 polish tasks (rows 8-22, 26) remained. This ADR governs how Phase 3 is executed and how knowledge artifacts are maintained.

## Decision

1. **Plan 113 supersedes plan 112** as the single execution tracker for Phase 3 polish. Plan 112 is marked SUPERSEDED (not deleted).

2. **ADRs 105, 106, 107 promoted Proposed → Accepted** upon plan 113 completion. Their policy domains are now active.

3. **Per-PR permanent fix** closes the corresponding `KNOWN-ISSUES.md` entry (removed, not just monitor-tier).

4. **LEARNINGS.md compaction** is part of every plan's "synthesize" phase, not deferred.

5. **AGENTS.md + agent skills** are updated in the same plan that introduces the pattern (no drift).

6. **Worktree-per-PR** is the canonical pattern (codified, not tribal).

7. **Codacy fix patterns** are first-class citizens in `code-quality` skill.

## Consequences

- Plans/ folder grows by 2 files (plan 113 + ADR-113)
- Plan 112 remains as historical record with SUPERSEDED header
- KNOWN-ISSUES.md is audited and pruned in the same change set
- Agent skills are updated with new patterns (bounded regex, traceId ordering, etc.)

## Follow-up

- PRs 11 (105-ui), 13 (107 P4), 14 (107 P1), 15 (107 P1/P2), 16 (known-issues) deferred to follow-up plan
