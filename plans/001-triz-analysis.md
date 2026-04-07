# TRIZ ANALYSIS PHASE

## Reference

- TRIZ Analysis Skill: `triz-analysis/SKILL.md`
- TRIZ Principles: [.agents/skills/triz-solver/reference/principles.md](https://github.com/d-o-hub/github-template-ai-agents/blob/main/.agents/skills/triz-solver/reference/principles.md)
- TRIZ Patterns: [.agents/skills/triz-solver/reference/patterns.md](https://github.com/d-o-hub/github-template-ai-agents/blob/main/.agents/skills/triz-solver/reference/patterns.md)

## Scope

System:
- EPUB reader
- offline sync
- permissions
- R2 + Turso split

## Required contradictions

Examples to identify:

- Security vs Usability
- Offline availability vs Access control
- Performance vs Flexibility
- Simplicity vs Feature richness
- Local-first vs Consistency

## Output

Must generate: `analysis/triz-core-YYYY-MM-DD.md`

## Required format

For each contradiction:

```
Improving: X  
Worsens: Y  
Why: explanation  
Reality: real vs assumed  
```

Then map → TRIZ principles

## Workflow

```bash
# Step 1: Run TRIZ analysis
run skill: triz-analysis
scope: apps/, worker/, architecture
output: analysis/triz-core-$(date +%F).md
```

## Real TRIZ targets for EPUB Studio

1. Offline vs Security - offline EPUB caching vs access revocation
2. R2 vs Turso - file storage vs queryable state
3. Reader vs Editor complexity - simple reader vs editorial features
4. Performance vs EPUB flexibility - large EPUB vs browser constraints
5. Sync vs consistency - local-first vs server truth
