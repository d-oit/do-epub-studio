---
name: task-decomposition
description: Break down complex tasks into atomic, actionable goals with clear dependencies and success criteria. Use when planning multi-step projects, coordinating agents, or decomposing complex requests.
---

# Task Decomposition

Decompose high-level objectives into manageable, testable sub-tasks.

## When to Use

- Complex requests with multiple components
- Multi-phase projects
- Tasks benefiting from parallel execution

## Framework

### 1. Requirements Analysis
- Primary objective
- Implicit requirements
- Constraints
- Success criteria

### 2. Goal Hierarchy
```
Main Goal
├─ Sub-goal 1 → Tasks 1.1, 1.2
├─ Sub-goal 2 → Task 2.1
└─ Sub-goal 3
```

### 3. Dependency Mapping
- Sequential: A → B → C
- Parallel: A, B, C (independent)
- Converging: A, B, C → D

## Process

### Step 1: Understand Goal
```
Request: [Original]
Goal: [Main objective]
Complexity: [Simple/Medium/Complex]
```

### Step 2: Identify Components (3-7)
```
Goal: Implement feature
Components: Database, API, Logic, Testing, Docs
```

### Step 3: Decompose & Map
```
Component: Database
Tasks: 1. Design schema, 2. Implement operations
```

### Step 4: Assign Priorities
- P0: Critical
- P1: Important
- P2: Nice-to-have

## Patterns

### Layer-Based
1. Data/Storage
2. Business logic
3. API
4. Testing
5. Documentation

### Feature-Based
1. Core (MVP)
2. Error handling
3. Performance
4. Integration
5. Testing
6. Docs

## Quality Checklist

✓ Atomic and actionable tasks
✓ Dependencies identified
✓ Measurable success criteria
✓ No task > 4 hours
✓ Parallelization opportunities

## EPUB Studio Context

Use for:
- Architecture decisions (with TRIZ)
- Multi-app coordination (worker/web)
- EPUB feature implementation
- Offline sync design

## References

- `reference/guide.md` - Complete guide
