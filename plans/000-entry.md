# ENTRY POINT

This repository follows a strict TRIZ-first planning model.

## Reference Repos

- Base agent system: [github-template-ai-agents](https://github.com/d-o-hub/github-template-ai-agents)
- Skills root: [.agents/skills/](https://github.com/d-o-hub/github-template-ai-agents/tree/main/.agents/skills)

## Execution order (MANDATORY)

```bash
# Step 1: Setup skills (REQUIRED FIRST)
./scripts/setup-skills.sh

# Step 2: Run TRIZ analysis
run skill: triz-analysis
scope: apps/, worker/, architecture
output: analysis/triz-core-$(date +%F).md

# Step 3: Run TRIZ solver
run skill: triz-solver
input: analysis/triz-core-*.md
output: plans/002-triz-resolution.md

# Step 4: Validate skill outputs
run skill: skill-evaluator
target: triz-analysis + triz-solver outputs

# Step 5: Quality gate before commit
./scripts/quality_gate.sh
```

## Rule

**NO CODE BEFORE:**

1. triz-analysis executed
2. contradictions written to analysis/
3. triz-solver applied
4. plans updated

Violation = invalid implementation

## Workflow

```
skill-creator
    ↓
skill-evaluator
    ↓
triz-analysis
    ↓
triz-solver
    ↓
plans/
    ↓
coding
```
