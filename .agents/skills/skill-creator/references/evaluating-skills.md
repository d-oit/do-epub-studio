# Evaluating Skills

## Overview

This guide covers how to evaluate skill output quality and measure skill performance.

## Quality Dimensions

| Dimension | Description |
|-----------|-------------|
| Accuracy | Output matches expected result |
| Completeness | All required components present |
| Consistency | Output stable across runs |
| Relevance | Output addresses user intent |
| Safety | No harmful or inappropriate content |

## Scoring Scale

- **Pass (1)**: Meets all criteria
- **Partial (0.5)**: Meets some criteria
- **Fail (0)**: Does not meet criteria

## Evaluation Workflow

### 1. Structure Check

Confirm the skill directory is sane before judging outputs.

Expected layout:

```
skill-name/
  SKILL.md
  evals/evals.json          # recommended
  references/               # recommended
  scripts/                  # optional but useful
```

### 2. Eval Review

Read `evals/evals.json` if present and assess whether each case is realistic.

Good evals include:

- a real user prompt
- a short success definition
- optional input files
- assertions that are concrete and checkable

### 3. Live Run

Run at least one representative prompt from the eval set.

For each live run:

- load the target skill
- read only the files the skill itself points to
- produce the answer or output
- grade against assertions with evidence

### 4. Baseline Comparison

When useful, rerun the same prompt without the skill.

Compare:

- pass rate
- missing details
- format compliance
- time or token cost if available

### 5. Verdict

End with one of:

- `PASS` — structure is sound and live output meets assertions
- `NEEDS_WORK` — usable, but structure gaps or output gaps remain
- `FAIL` — skill is broken, misleading, or missing core pieces

## Assertion Rules

Prefer assertions that can be checked directly.

Good:

- `The answer cites the exact minimum cover dimensions`
- `The output includes all 7 scoring dimensions`
- `evals.json contains at least 2 cases`

Bad:

- `The output is good`
- `The skill feels smart`
- `The answer is polished`

Every pass or fail must include evidence.

## Reporting Format

```text
## Eval Report: <skill-name>

- Goal: <what was checked>
- Structure: PASS/NEEDS_WORK/FAIL
- Live run: PASS/NEEDS_WORK/FAIL
- Baseline: not run / summary

### Assertion Results
- PASS: <assertion> — <evidence>
- FAIL: <assertion> — <evidence>

### Issues
- <issue>

### Next Fixes
1. <highest-value fix>
2. <next fix>

### Verdict
PASS | NEEDS_WORK | FAIL — <one sentence>
```
