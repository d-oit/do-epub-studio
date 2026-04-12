---
name: guide
description: Complete task decomposition guide with detailed framework, process, patterns, examples, and EPUB Studio integration
license: MIT
---

# Task Decomposition - Reference Guide

Comprehensive guide for breaking down complex tasks into atomic, actionable goals.

## Decomposition Framework - Deep Dive

### 1. Requirements Analysis

**Extract Information**:

- Primary objective (what user wants to achieve)
- Implicit requirements (quality, performance, documentation)
- Constraints (time, resources, compatibility)
- Success criteria (how to measure completion)

**Analysis Template**:

```markdown
## Requirements Analysis

**User Request**: [Original request]

**Primary Objective**: [Clear statement of main goal]

**Implicit Requirements**:
- Quality: [Standards expected]
- Performance: [Speed, memory requirements]
- Documentation: [API docs, examples needed]

**Constraints**:
- Time: [Deadline if any]
- Resources: [Available tools, agents]
- Compatibility: [Must work with Cloudflare Workers, Turso, etc.]

**Success Criteria**:
- [ ] Criterion 1 (measurable)
- [ ] Criterion 2 (measurable)
- [ ] Criterion 3 (measurable)
```

### 2. Goal Hierarchy

**Top-Down Decomposition**:

```
Main Goal: [High-level objective]
├─ Sub-goal 1: [Component 1]
│  ├─ Task 1.1: [Atomic action]
│  └─ Task 1.2: [Atomic action]
├─ Sub-goal 2: [Component 2]
│  ├─ Task 2.1: [Atomic action]
│  └─ Task 2.2: [Atomic action]
└─ Sub-goal 3: [Component 3]
   └─ Task 3.1: [Atomic action]
```

**Atomic Task Criteria**:

- Single, clear action
- Well-defined inputs and outputs
- Can be completed by one agent
- Testable/verifiable completion
- Time-bounded (estimable duration)

### 3. Dependency Mapping

**Dependency Types**:

#### Sequential Dependencies

```
Task A → Task B → Task C
```

**Example**: Design schema → Create migration → Insert data

#### Parallel Independent

```
Task A ─┐
Task B ─┼─ [All can run simultaneously]
Task C ─┘
```

**Example**: Test module A, Test module B, Test module C

#### Converging Dependencies

```
Task A ─┐
Task B ─┼─> Task D
Task C ─┘
```

**Example**: Implement features A, B, C → Integration testing

### 4. Success Criteria Definition

For each task, define inputs, outputs, and quality standards.

## Decomposition Process - Step by Step

### Step 1: Understand Goal

```markdown
User Request: [Original request]
- Primary Goal: [Main objective]
- Type: [Implementation/Debug/Refactor/Analysis]
- Domain: [EPUB, Worker, DB, Frontend]
- Complexity: [Simple/Medium/Complex]
```

### Step 2: Identify Major Components (3-7)

```markdown
Main Goal: Implement book permission system

Major Components:
1. Database layer (Turso schema)
2. API layer (Worker routes)
3. Frontend (React UI)
4. Business logic (Services)
5. Testing
6. Documentation
```

### Step 3: Decompose Each Component

```markdown
Component: Database layer
Tasks:
1. Design permission schema
2. Create migration script
3. Add index for queries
```

### Step 4: Map Dependencies

```markdown
[Design schema] → [Create migration] → [Add API route]
                                      ↘ [Add frontend]
```

### Step 5: Assign Priorities

- **P0 (Critical)**: Must complete for goal
- **P1 (Important)**: Improves quality/functionality
- **P2 (Nice-to-have)**: Enhancement only

### Step 6: Estimate Complexity

- **Low**: <30 min, well-understood
- **Medium**: 30 min - 2 hours
- **High**: >2 hours, significant unknowns

## Decomposition Patterns

### Pattern 1: Layer-Based (Architecture Changes)

```
1. Data/Storage (Turso/R2)
2. Business Logic (Services)
3. API (Cloudflare Worker)
4. Frontend (React)
5. Testing
6. Documentation
```

### Pattern 2: Feature-Based (New Features)

```
1. Core (MVP)
2. Error handling
3. Performance
4. Integration
5. Testing
6. Documentation
```

### Pattern 3: Phase-Based (Large Projects)

```
Phase 1: Research & Design
Phase 2: Foundation
Phase 3: Implementation
Phase 4: Integration
Phase 5: Polish
Phase 6: Release
```

### Pattern 4: Problem-Solution (Debugging)

```
1. Reproduce
2. Diagnose
3. Design
4. Fix
5. Verify
6. Prevent
```

## Example Decompositions

### Example: Simple - Fix Failing Test

```
Request: Fix failing test in book service

Tasks:
1. Run test to observe failure
2. Identify root cause
3. Apply fix
4. Verify test passes
5. Check for similar issues

Complexity: Low
Time: 15-30 minutes
```

### Example: Medium - Add Book Permission

```
Request: Add book permission system

Tasks:
1. Design permission schema (Turso)
2. Create migration script
3. Implement permission service
4. Add Worker API routes
5. Add React frontend
6. Write tests (unit + integration)
7. Update documentation

Dependencies: 1→2→3→4, 5→4, 6→4
Complexity: Medium
Time: 2-4 hours
```

### Example: Complex - Offline Sync

```
Request: Add offline sync for books

Components:
1. Storage abstraction (IndexedDB)
2. Sync logic (Worker)
3. Conflict resolution
4. Frontend UI
5. Testing
6. Migration

Strategy: Multi-phase
Time: 1-2 days
```

## Quality Checklist

✓ Atomic and actionable tasks
✓ Dependencies identified
✓ Measurable success criteria
✓ Complexity appropriately estimated
✓ No task >4 hours
✓ Parallelization opportunities
✓ Quality tasks included
✓ TRIZ analysis for architecture tasks

## EPUB Studio Integration

### Must Run TRIZ Analysis For

- Architecture changes
- Permission system changes
- Offline sync implementation
- EPUB rendering changes
- API design

### Include in Plans

- ADR in `plans/`
- Phase plans in `plans/`
- Schema migrations in `migrations/`

## GOAP Agent Integration

```
1. Receive user request
2. Apply decomposition (this skill)
3. Create execution plan
4. Execute with monitoring
5. Report results
```
