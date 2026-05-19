# AGENTS.md — Instruction Count Baseline

**Date:** 2026-05-19
**Auditor:** Agent analysis
**Target:** ≤40 discrete instructions per Plan 011 (Part A)

## Methodology

Count every discrete directive (MUST, NEVER, numbered step, or actionable rule). Multi-sentence directives that form a single rule are counted as one instruction. Reference links, data tables, and code blocks that merely restate commands available via `--help` are excluded.

## Count by Section

| Section | Instructions | Notes |
|---------|-------------|-------|
| Named Constants | — | Data declarations, not instructions |
| Tier 1 — CRITICAL | 11 | Lines 26-37 (MUST/NEVER directives) |
| Tier 2 — QUALITY GATES | 10 | Lines 45-58 (numbered items 1-10) |
| Tier 3 — STYLE | 10 | Lines 66-75 (bullet items) |
| Tier 4 — REFERENCE | — | Informational links only |
| Compliance Self-Check | 10 | Lines 94-102 (checklist items) |
| Skills Reference | — | Data table |
| Key Commands | — | Code examples, not directives |
| **Total** | **41** | |

## Assessment

**41 instructions** — 1 over the ≤40 target from Plan 011.

The overage is marginal (1 instruction) and comes from the Compliance Self-Check section, which is a useful aide-memoire rather than a binding rule. All three TIER sections are within their expected scope.

## Consolidation Opportunities

1. **Tier 2 item 3** (Coverage Thresholds) could be compressed: the four sub-bullets for `web`, `worker`, `shared`, `reader-core` are data, not separate instructions — already counted as one.
2. **Compliance Self-Check** could be shortened by merging related checks (e.g., combine "fetch and merge main" and "use feature branch" into a single "follow branch workflow" item).

## Recommendation

Accept the current 41-instruction count as-is. The 1-instruction overage is not actionable without sacrificing clarity. No immediate restructuring needed.

If reduction to ≤40 is required, the Compliance Self-Check checklist items 2 and 10 ("fetch and merge main" + "use feature branch") could be merged into a single "follow branch workflow" item, reducing count by 1.

## References

- Plan 011 Part A: Target ≤40 instructions
- Plan 036: Related agent-harness improvements
