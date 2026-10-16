---
version: "1.0.0"
name: triz-solver
description: >
  Resolve contradictions found by triz-analysis. Activate after triz-analysis
  completes. Applies TRIZ principles to derive system design.
category: coordination
allowed-tools: Read Write Edit Grep Glob
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

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "The analysis file is a formality — I remember the contradictions." | Prerequisites require triz-analysis completed and `analysis/triz-core-YYYY-MM-DD.md` present; this skill MUST run AFTER it. |
| "Secondary contradictions will surface later if they matter." | The Rule forbids system design until new contradictions are checked and the result is NONE. |
| "Segmentation resolves everything, so skip the separation choice." | Core Loop step 3 picks Time, Space, Condition, or System-level per contradiction; the choice follows the contradiction's class. |
| "The fix is obvious, the IFR can wait." | Core Loop step 2 defines an IFR per contradiction, and IFR criteria require no added complexity and no new contradictions. |
| "Component mapping is documentation work for later." | System Design Derivation step 1 maps every solution to a component before design, recorded in `plans/003-system-design.md`. |

## Red Flags

- [ ] `New Contradictions:` left blank or omitted instead of explicitly stating whether it is NONE.
- [ ] A resolution block with no `**IFR:**` line.
- [ ] Solver started with no `analysis/triz-core-YYYY-MM-DD.md` in the tree.
- [ ] Solutions not mapped to a component in `plans/003-system-design.md`.
- [ ] One separation principle applied to every contradiction with no reference to its analyzed class.
- [ ] A contradiction marked resolved while an acknowledged secondary effect is left open.
