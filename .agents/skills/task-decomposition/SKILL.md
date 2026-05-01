---
version: "1.0.0"
name: task-decomposition
description: >
  Break down complex tasks into atomic, executable goals. Activate for
  multi-step feature planning, agent coordination, or request decomposition.
category: coordination
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Task Decomposition

Decompose high-level objectives into manageable, testable sub-tasks.

## When to Use

- Complex requests with multiple components
- Multi-phase projects requiring coordination
- Tasks benefiting from parallel execution
- EPUB Studio feature implementations
- Cloudflare Worker / Turso DB changes

## Framework

### 1. Requirements Analysis

Extract: Primary objective, implicit requirements, constraints, success criteria.

### 2. Goal Hierarchy

```
Main Goal
├─ Sub-goal 1 → Tasks 1.1, 1.2
├─ Sub-goal 2 → Task 2.1
└─ Sub-goal 3
```

**Atomic Criteria**: Single action, defined inputs/outputs, one agent, testable.

### 3. Dependency Mapping

- **Sequential**: A → B → C
- **Parallel**: A, B, C (independent)
- **Converging**: A, B, C → D

### 4. Success Criteria

Define: Inputs, outputs, quality standards.

## Process

### Step 1: Understand Goal

```
Request: [Original]
Goal: [Main objective]
Type: [Implementation/Debug/Refactor]
Complexity: [Simple/Medium/Complex]
```

### Step 2: Identify Components (3-7)

For EPUB Studio:

- Database/Storage
- API/Worker
- Frontend/UI
- Business Logic
- Testing
- Documentation

### Step 3: Decompose Components

```
Component: Database
Tasks: 1. Design schema, 2. Implement operations
```

### Step 4: Map Dependencies

```
[Design] → [Implement] → [Test]
```

### Step 5: Assign Priorities

- P0 (Critical), P1 (Important), P2 (Nice-to-have)

### Step 6: Estimate Complexity

- Low (<30min), Medium (30min-2hr), High (>2hr)

## Patterns

### EPUB Studio Layer-Based

1. Database/Storage (Turso/R2)
2. Business Logic (Services)
3. API (Cloudflare Worker)
4. Frontend (React/UI)
5. Testing
6. Documentation

### Feature-Based

1. Core (MVP)
2. Error handling
3. Performance
4. Integration (Worker ↔ DB)
5. Testing
6. Documentation

### Phase-Based

1. Research
2. Foundation (schema/architecture)
3. Implementation
4. Integration
5. Polish
6. Release

### Problem-Solution

1. Reproduce
2. Diagnose
3. Design
4. Fix
5. Verify
6. Prevent

## Examples

### Simple

```
Request: "Fix failing test"
Tasks: 1. Run test  2. Identify cause  3. Apply fix  4. Verify
Sequential, Low complexity
```

### Medium - Add Book Permission

```
Request: "Add book permission system"
Tasks: 1. Design schema, 2. Add migration, 3. Implement service, 4. Add API route, 5. Add frontend, 6. Test, 7. Docs
Dependencies: 1→2→3→4, 5→4, 6→4
```

### Complex - Offline Sync

```
Request: "Add offline sync"
Components: Storage, Sync Logic, Conflict Resolution, UI, Testing, Migration
Strategy: Multi-phase hybrid
```

## Quality Checklist

- [ ] Atomic and actionable tasks
- [ ] Dependencies identified
- [ ] Measurable success criteria
- [ ] Appropriate complexity estimates
- [ ] No task >4 hours
- [ ] Parallelization opportunities
- [ ] TRIZ analysis for architecture tasks

## EPUB Studio Specific

### Must Run TRIZ Analysis For

- Architecture changes
- Permission system changes
- Offline sync implementation
- EPUB rendering changes
- API design

### Include in Plans

- ADR (Architecture Decision Record)
- Phase plans in `plans/`
- Schema migrations in `migrations/`

## Integration

GOAP Phase 1: Decomposition → Execution Plan → Monitor → Report

### Use with GOAP Agent

For complex multi-step tasks requiring coordinated execution, use the **goap-agent** skill after decomposition:

1. Use **task-decomposition** to break down the goal
2. Use **goap-agent** to plan execution strategy (parallel/sequential/swarm)
3. Use **triz-analysis** for architectural tasks with trade-offs

The decomposition phase feeds directly into GOAP's planning cycle for optimal execution.

### Integration with Other Skills

- **goap-agent**: Execution planning and multi-agent coordination
- **triz-analysis**: Run before decomposition for architectural tasks
- **triz-solver**: Use when decomposition reveals contradictions
- **parallel-execution**: Execute independent tasks simultaneously

## Tips

1. **Start with Why**: Understand true goal
2. **Think Top-Down**: High-level first
3. **Consider User**: Value per task
4. **Plan for Quality**: Include testing/docs
5. **Anticipate Issues**: Identify risks
6. **Enable Parallelization**: Find independent tasks

## Summary

Good decomposition enables optimal execution, clear validation, and higher quality.
