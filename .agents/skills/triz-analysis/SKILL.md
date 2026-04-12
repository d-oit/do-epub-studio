---
version: "1.0.0"
name: triz-analysis
description: >
  Identify contradictions in system design. Activate for architecture decisions,
  permissions, offline sync, or EPUB rendering trade-offs. Must run BEFORE triz-solver.
category: coordination
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# TRIZ Analysis

Analyze system contradictions using TRIZ methodology. This skill MUST be run before triz-solver.

## When to Use

- Architecture decisions
- Permission system design
- Offline sync requirements
- EPUB rendering challenges
- Any non-trivial system design task

## Core Loop

1. **Define the system** - What are we analyzing?
2. **Identify parameters** - What properties matter?
3. **Find contradictions** - Where do properties conflict?
4. **Classify contradictions** - Technical or physical?
5. **Map to TRIZ principles** - Find applicable solutions
6. **Document findings** - Output to analysis/

---

## Contradiction Types

### Technical Contradictions

| Improving | Worsens |
|-----------|---------|
| Security | Usability |
| Offline availability | Access control |
| Performance | Flexibility |
| Simplicity | Feature richness |

### Physical Contradictions

- Element must be in two opposite states
- Resource constraints create conflicts
- Boundary conditions conflict

---

## Required Output Format

For each contradiction identified:

```markdown
### Contradiction N

**Improving:** [Property A]
**Worsens:** [Property B]
**Why:** [Explanation of causality]
**Reality:** [Real vs assumed - verify assumption]

**TRIZ Principles Available:**
- [List relevant principles]
```

---

## Output Location

Write analysis to: `analysis/triz-core-YYYY-MM-DD.md`

---

## Verification Steps

1. List all system properties
2. For each property, identify what it worsens
3. Verify contradictions are real (not assumed)
4. Check if any contradiction is already resolved
5. Flag unresolved for triz-solver

---

## Key TRIZ Principles

1. Segmentation
2. Extraction
3. Local Quality
4. Asymmetry
5. Nesting
6. Weight Compensation
7. Dynamicity
8. Partial or Excessive Action
9. Heterogeneity
10. Staticion

---

## Common System Contradictions in EPUB Studio

| Improving | Worsens | Notes |
|-----------|---------|-------|
| Offline reading | Access control | Cached books bypass auth |
| EPUB performance | Security | Parsing complexity |
| Annotation sync | Local-first | Consistency conflicts |
| Reader flexibility | Simplicity | Feature bloat |
| Offline availability | Storage | Device constraints |

---

## Rule

**No coding before:**

- All contradictions identified
- Each mapped to TRIZ principles
- Analysis written to file

**Violation = invalid implementation**
