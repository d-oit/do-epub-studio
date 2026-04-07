---
name: parallel-execution
description: Execute multiple independent tasks simultaneously using parallel agent coordination to maximize throughput and minimize execution time. Use when tasks have no dependencies and results can be aggregated.
version: "1.0"
---

# Parallel Execution

Execute multiple independent tasks simultaneously to maximize throughput and minimize total execution time.

## When to Use

- Multiple independent tasks (no dependencies)
- Tasks benefit from concurrent execution
- Results can be aggregated after completion

## Core Concepts

### Independence

Tasks are independent when:
- No data dependencies
- No resource conflicts
- No ordering requirements
- Failures are isolated

### Concurrency

Use single message with multiple Task tool calls:

```
Single message:
- Task -> Agent A
- Task -> Agent B
- Task -> Agent C

All start simultaneously.
```

### Synchronization

- Wait for all agents to complete
- Collect and validate results
- Aggregate into final output

## Process

1. Identify independent tasks
2. Assign agents
3. Launch parallel execution (single message, multiple Task calls)
4. Monitor execution
5. Collect and validate results
6. Aggregate

## Execution Patterns

### Homogeneous Parallel
Same agent type, different inputs:
```
- test-runner: Test module A
- test-runner: Test module B
- test-runner: Test module C
```

### Heterogeneous Parallel
Different agent types:
```
- code-reviewer: Quality analysis
- test-runner: Test execution
- debugger: Performance profiling
```

## Best Practices

- Verify independence first
- Use single message with multiple tools
- Balance workload
- Handle failures gracefully
- Validate each result

## Anti-Patterns

- Parallelizing dependent tasks
- Sending sequential messages instead of parallel
- Overloading single agent
- Skipping validation
