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

| Strategy | Example |
|----------|---------|
| Time | Cache with TTL - fast at read, consistent after expiry |
| Space | Strong auth for admin, lightweight for public |
| Condition | Eager loading for small datasets, lazy for large |
| System-Level | Service mesh resolves coupling vs communication overhead |
