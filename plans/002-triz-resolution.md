# TRIZ RESOLUTION

## Reference

- TRIZ Solver Skill: `triz-solver/SKILL.md`
- TRIZ Principles: [.agents/skills/triz-solver/reference/principles.md](https://github.com/d-o-hub/github-template-ai-agents/blob/main/.agents/skills/triz-solver/reference/principles.md)
- TRIZ Patterns: [.agents/skills/triz-solver/reference/patterns.md](https://github.com/d-o-hub/github-template-ai-agents/blob/main/.agents/skills/triz-solver/reference/patterns.md)

## Workflow

```bash
# Step 2: Run TRIZ solver
run skill: triz-solver
input: analysis/triz-core-*.md
output: plans/002-triz-resolution.md
```

## For each contradiction

1. **Define IFR** (Ideal Final Result)
2. **Choose separation**:
   - time (different behavior at different stages)
   - space (different behavior in different contexts)
   - condition (different behavior based on input)
   - system-level (add component that resolves both)

3. **Apply TRIZ principles** from reference

## Output format

```
Problem:
Contradiction:
IFR:
Solution:
Why better:
New contradictions: none
```

## Gate

No unresolved contradictions allowed before system design.

## Separation Strategies

From patterns reference:

| Strategy     | Example                                                  |
| ------------ | -------------------------------------------------------- |
| Time         | Cache with TTL - fast at read, consistent after expiry   |
| Space        | Strong auth for admin, lightweight for public            |
| Condition    | Eager loading for small datasets, lazy for large         |
| System-Level | Service mesh resolves coupling vs communication overhead |

---

### Resolved: Contradiction 1 – Coverage Depth vs Throughput

**Problem:** Deep repository sweeps surface more defects but drastically slow down swarm response.
**IFR:** Achieve critical-path coverage within the same wall clock time as a shallow scan.
**Separation:** Space + Time – segment work by capability area and execute in parallel windows with adaptive sampling windows.
**Solution:** Partition repo into capability slices (auth/access, reader UI, worker/api, schema/tests). Assign one agent per slice with a prioritized checklist derived from plans/ADRs. Agents follow a depth-first sample within their slice and stop after marginal utility drops, escalating only the issues meeting severity bar. Coordinator merges results and calls follow-up scans on suspicious areas.
**Why Better:** Maintains high signal because each agent specializes, parallelizes workload to protect throughput, and avoids redundant coverage.
**New Contradictions:** None.

### Resolved: Contradiction 2 – Automation Scale vs Signal Quality

**Problem:** Many autonomous agents accelerate discovery but increase conflicting/noisy findings.
**IFR:** Multi-agent run produces deduplicated, rubric-aligned findings without manual cleanup.
**Separation:** Condition – differentiate agent roles + enforce shared reporting template.
**Solution:** Provide each agent with a unique perspective charter (feature, implementation, docs/tests, architecture/security) and a canonical gap schema (missing item, impact, priority, remediation). Coordinator enforces a deduplication pass that merges identical issues and highlights cross-perspective confirmations.
**Why Better:** Condition-based differentiation reduces overlap; enforced schema ensures signal consistency and simplifies aggregation.
**New Contradictions:** None.

### Resolved: Contradiction 3 – Evidence Granularity vs Cognitive Load

**Problem:** Line-level citations improve auditability but overwhelm readers when mixed with top-level summary.
**IFR:** Reports remain scannable while preserving traceable evidence.
**Separation:** Space – split summary and appendix layers.
**Solution:** Store primary conclusions + priority table at top of `analysis/SWARM_ANALYSIS.md`, followed by per-gap detail tables with citations. Provide expanded evidence in collapsible sections (markdown subheadings) or reference files/statements without repeating entire excerpts.
**Why Better:** Readers get immediate priorities yet can drill into supporting data when needed.
**New Contradictions:** None.
