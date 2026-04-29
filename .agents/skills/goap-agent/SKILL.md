---
version: "1.0.0"
name: goap-agent
description: >
  Invoke for complex multi-step tasks requiring intelligent planning and multi-agent
  coordination. Use when tasks need decomposition, dependency mapping, parallel/sequential/swarm
  execution strategies, or coordination of multiple specialized agents with quality gates.
category: coordination
allowed-tools: Read Write Edit Glob Grep
license: MIT
---

# GOAP Agent Skill: Goal-Oriented Action Planning

Enable intelligent planning and execution of complex multi-step tasks through systematic decomposition, dependency mapping, and coordinated multi-agent execution.

Always use the `plans/` folder for all planning files.

## When to Use This Skill

- **Complex Multi-Step Tasks**: Tasks requiring 5+ distinct steps
- **Cross-Domain Problems**: Issues spanning multiple areas (DB, API, UI, tests)
- **Optimization Opportunities**: Tasks benefiting from parallel execution
- **Quality-Critical Work**: Projects requiring validation checkpoints

## Quick Reference

| Strategy | Best For | Speed |
|----------|----------|-------|
| Parallel | Independent tasks | Nx |
| Sequential | Dependent tasks | 1x |
| Swarm | Many similar tasks | ~Nx |
| Hybrid | Mixed requirements | 2-4x |

## Core GOAP Methodology

### The GOAP Planning Cycle

```
1. ANALYZE → 2. DECOMPOSE → 3. STRATEGIZE → 4. COORDINATE → 5. EXECUTE → 6. SYNTHESIZE
```

## Phase 1: Task Analysis

**Primary Goal**: Clear statement of what success looks like
**Constraints**: Time, Resources, Dependencies
**Complexity**: Simple/Medium/Complex

Context: Use Explore agent, check past patterns, identify available agents/skills.

## Phase 2: Task Decomposition

Use **task-decomposition** skill to break down:

1. [Component 1] - Priority: P0, Deps: none
2. [Component 2] - Priority: P1, Deps: Component 1
3. [Component 3] - Priority: P1, Deps: Component 1

**Principles**: Atomic, Testable, Independent, Assigned

## Phase 3: Strategy Selection

| Strategy | When to Use |
|----------|-------------|
| **Parallel** | Tasks have no dependencies |
| **Sequential** | Tasks depend on each other |
| **Swarm** | Many similar small tasks |
| **Hybrid** | Mixed dependencies |

### Decision Tree

```
Are tasks independent?
├─ YES → Can they run simultaneously?
│       ├─ YES → Parallel
│       └─ NO → Sequential
└─ NO → Sequential (with proper ordering)
```

## Phase 4: Agent Assignment

| Agent Type | Best For |
|------------|----------|
| `cloudflare-worker-api` | Worker/API development |
| `turso-db` | Database schema and migrations |
| `reader-ui-ux` | React UI components |
| `testing-strategy` | Test planning and execution |
| `code-review-assistant` | PR reviews |

## Phase 5: Execution Planning

- **Strategy**: [Parallel/Sequential/Swarm/Hybrid]
- **Quality Gates**: [N checkpoints]

### Phase 1: Research/Foundation
- Tasks: [List]
- Quality Gate: [Criteria]

### Phase 2: Implementation
- Tasks: [List]
- Quality Gate: [Criteria]

## Phase 6: Coordinated Execution

### Parallel Execution
- Send all independent tasks in single message
- Use Task tool with multiple calls

### Sequential Execution
- Execute phase 1, validate, then phase 2
- Quality gate between each phase

### Swarm Execution
- Multiple agents analyze different aspects simultaneously
- Synthesize results after all complete

## Phase 7: Result Synthesis

```
✓ Completed: [Task list]
📦 Deliverables: [Files created/modified]
⚠️ Blocked: [Any issues]
✅ Quality: [Gate results]
```

## EPUB Studio Specific Patterns

### Feature Implementation Pattern

1. TRIZ Analysis → Identify contradictions
2. Database (turso-db) → Schema + migrations
3. API (cloudflare-worker-api) → Routes + handlers
4. Frontend (reader-ui-ux) → Components + state
5. Testing (testing-strategy) → Unit + E2E

### Bug Fix Pattern

1. Reproduce → Dogfood/testing-strategy
2. Diagnose → Root cause analysis
3. Design → Solution with TRIZ if architectural
4. Fix → Appropriate skill by area
5. Verify → Tests pass
6. Prevent → Add test coverage

### Refactoring Pattern

1. Analyze → Current state, dependencies
2. Plan → Migration path with TRIZ if trade-offs
3. Execute → Incremental changes
4. Validate → Tests, typecheck, lint

## Error Handling

| Failure Type | Response |
|--------------|----------|
| Agent fails | Retry → Reassign → Modify → Escalate |
| Quality gate fails | Fix → Re-run gate |
| Dependency blocked | Re-order → Parallel work-around |

## Quality Checklist

- [ ] Primary goal clearly stated
- [ ] All tasks atomic and independent where possible
- [ ] Dependencies mapped correctly
- [ ] Strategy matches task characteristics
- [ ] Quality gates defined between phases
- [ ] Plan written to `plans/` directory
- [ ] Results synthesized after completion

## Integration

- **task-decomposition**: Phase 2 - task breakdown
- **triz-analysis**: Use before planning for architectural tasks
- **triz-solver**: Use when stuck on contradictions
- **parallel-execution**: Strategy implementation for parallel tasks

## Reference Files

- `references/execution-strategies.md` - Detailed execution patterns
- `references/agent-assignments.md` - Agent capability mapping
- `plans/` - Store all planning documents here

## Summary

GOAP enables systematic planning through:
1. **Analysis** - Understand the goal and constraints
2. **Decomposition** - Break into atomic tasks
3. **Strategy** - Choose execution approach
4. **Coordination** - Assign to specialized agents
5. **Execution** - Run with quality gates
6. **Synthesis** - Document results and next steps
