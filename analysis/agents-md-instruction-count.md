# AGENTS.md Instruction Count Tracking

| Date | Total Lines | Imperative Instructions | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Notes |
|------|-------------|-------------------------|--------|--------|--------|--------|-------|
| 2025-01-XX | 245 | ~79 | TBD | TBD | TBD | TBD | Current baseline |
| 2026-04-28 | - | 79 | 9 | 10 | 20 | 40 | Per Plan 011 analysis |

---

## Baseline Analysis (2025-01-XX)

### Current State

- **Total lines**: 245
- **Discrete instructions**: ~79 bullet points
- **Named Constants**: 5 defined
- **Max file size limits**: MAX_LINES_PER_SOURCE_FILE=500, MAX_LINES_AGENTS_MD=150 (exceeds!)

### Instruction Distribution

| Section | Approximate Count | Type |
|---------|-------------------|------|
| Named Constants | 5 | Configuration |
| TIER 1 - Critical | 9 | Safety/Security |
| TIER 2 - Quality Gates | 10 | Blocking |
| TIER 3 - Style | 20 | Guidelines |
| TIER 4 - Reference | 40 | Links/Ceremonial |

### Phrasing Analysis

- Uses of "NEVER": 0
- Uses of "MUST": 0
- Uses of "ALWAYS": 0
- Uses of "DO NOT": 0

**Compliance Risk**: HIGH - 79 instructions exceeds the ~40 reliable instruction limit identified in research.

---

## Recommended Actions (per Plan 011)

1. **Reduce to ≤40 instructions** - Target imperative count
2. **Reorder by tier** - Critical items first
3. **Use imperative phrasing** - Add NEVER, MUST, ALWAYS
4. **Add Compliance Self-Check** - Before responding
5. **Move ceremonial content** - To agents-docs/

---

## References

- Plan 011: Coding Workflow Improvements
- Plan 012: Comprehensive Analysis Findings
- AGENTS.md: Current document
