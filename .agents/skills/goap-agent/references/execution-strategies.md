# Execution Strategies Reference

Detailed patterns for GOAP execution strategies.

## Parallel Execution

Send all independent tasks in a single message. Use the Task tool with multiple calls.

**Best for:**
- Independent UI components
- Multiple API endpoints
- Stateless transformations
- Multiple test files

**Speed:** Nx (all run simultaneously)

## Sequential Execution

Execute phase 1, validate, then phase 2. Quality gate between each phase.

**Best for:**
- Schema → Migration → API → UI
- Dependent tasks where output feeds input
- Any task with quality gates

**Speed:** 1x (one after another)

## Swarm Execution

Multiple agents analyze different aspects simultaneously, then synthesize results.

**Best for:**
- Many similar small tasks
- Pattern fixes across codebase
- Comprehensive reviews

**Speed:** ~Nx (parallel research, sequential synthesis)

## Hybrid Execution

Mix of parallel and sequential. Parallel for research, sequential for implementation.

**Best for:**
- Mixed dependency requirements
- Investigation + implementation
- When some tasks can parallelize but results need combining

**Speed:** 2-4x

## Decision Tree

```
Are tasks independent?
├─ YES → Can they run simultaneously?
│       ├─ YES → Parallel
│       └─ NO → Sequential
└─ NO → Sequential (with proper ordering)
```
