---
name: triz-solver
description: Resolve contradictions identified by triz-analysis. Use when applying TRIZ principles to solve technical contradictions, implementing separation principles, or deriving system design from resolved contradictions. Must be run AFTER triz-analysis.
license: MIT
---

# TRIZ Solver

Resolve contradictions using TRIZ methodology. This skill MUST be run AFTER triz-analysis.

## Prerequisites

- triz-analysis completed
- analysis/triz-core-YYYY-MM-DD.md exists
- Contradictions identified and mapped

## Core Loop

1. **Review analysis** - Read identified contradictions
2. **Define IFR** - Ideal Final Result for each
3. **Choose separation** - Time, space, condition, or system-level
4. **Apply TRIZ principles** - Select and implement
5. **Check for new contradictions** - Secondary effects
6. **Document resolution** - Update plans/

---

## Separation Principles

### Time Separation
- Opposite states at different times
- Buffer solutions for timing conflicts

### Space Separation
- Opposite states in different locations
- Split systems spatially

### Condition Separation
- Opposite states under different conditions
- Conditional logic solutions

### System-Level Separation
- Move contradiction to higher/lower system level
- Delegate to subsystem

---

## IFR Framework

For each contradiction, define:

```
Ideal Final Result:
The system [desired outcome] WITHOUT [what causes the problem]

IFR Criteria:
- No additional complexity
- No new contradictions introduced
- Solves original problem completely
```

---

## Resolution Output Format

```markdown
### Resolved: Contradiction N

**Problem:** [Original contradiction]
**IFR:** [Ideal Final Result]
**Separation:** [Time/Space/Condition/System-level]
**Solution:** [How it's resolved]
**Why Better:** [Benefits over original]
**New Contradictions:** [Any secondary effects - NONE if resolved]
```

---

## Key TRIZ Principles for Resolution

1. **Segmentation** - Divide into independent parts
2. **Extraction** - Remove problematic part
3. **Local Quality** - Make each part different
4. **Asymmetry** - Change symmetry where possible
5. **Nesting** - Place one inside another
6. **Dynamicity** - Make static into adjustable
7. **Partial Action** - Do partially, not completely
8. **Heterogeneity** - Use different materials
9. **Phase Transition** - Use state changes
10. **Operational Environment** - Use environment properties

---

## System Design Derivation

After resolving contradictions:

1. Map each solution to system component
2. Define interface between components
3. Verify no new contradictions introduced
4. Document in plans/003-system-design.md

---

## Rule

**No system design before:**
- All contradictions resolved
- Solutions mapped to components
- New contradictions checked (must be NONE)

**Violation = incomplete architecture**