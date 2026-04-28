# AGENTS.md Instruction Count Tracking

This file tracks instruction count and compliance metrics per issue #234.

## Why Track This?

Research shows frontier models achieve max **68% compliance** at ~500 instructions in AGENTS.md files. One third of all instructions are ignored—typically those at the **bottom** and those **phrased ambiguously**.

Target: ≤40 discrete imperative instructions for reliable agent compliance.

## Metrics

| Date | Instruction Count | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Notes |
|------|-------------------|--------|--------|--------|--------|-------|
| 2026-04-28 | 79 | TBD | TBD | TBD | TBD | Baseline - needs restructure |
| 20XX-XX-XX | | | | | | |

## Tier Definitions

- **TIER 1** (Critical Safety): Security, secrets, permissions, branch protection
- **TIER 2** (Quality Gates): Pre-commit, commit format, tests required
- **TIER 3** (Style): Formatting, naming, documentation style
- **TIER 4** (Ceremonial): Links, historical notes, tutorials (move to agents-docs/)

## Audit Checklist

When updating AGENTS.md:

- [ ] Count all discrete bullet-point instructions
- [ ] Assign each to a tier (1-4)
- [ ] Verify TIER 1 instructions are in first 20 lines
- [ ] Check all instructions use imperative phrasing (DO, NEVER, MUST, ALWAYS)
- [ ] Update this file with new measurements

## Reference

- Issue: d-o-hub/github-template-ai-agents#234
- Plan: `plans/011-coding-workflow-improvements.md`
