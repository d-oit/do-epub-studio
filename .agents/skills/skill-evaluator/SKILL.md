---
version: "1.0.0"
name: skill-evaluator
description: >
  Evaluate skill output quality with grading, benchmarking, and human review.
  Activate for benchmarking skills, comparing versions, or validating evals.
category: quality
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Skill Evaluator

Evaluate and measure skill performance. This is the canonical evaluation tool
that `skill-creator` delegates to for grading, benchmarking, and human review.

## When to Use

- `skill-creator` requests evaluation after drafting a skill.
- Comparing old vs new version of a skill.
- Diagnosing why a skill produces poor output for certain prompts.
- Benchmarking skill quality before committing changes.

## Core Loop

1. **Define evals** — 2-3 realistic prompts with `expected_output` in `evals/evals.json`.
2. **Run baseline** — Execute each prompt **without** the skill (or previous version).
3. **Run with skill** — Execute each prompt **with** the skill active.
4. **Grade** — Score assertions against outputs, save `grading.json`.
5. **Benchmark** — Aggregate pass rate, time, token deltas, save `benchmark.json`.
6. **Human review** — Review outputs for issues not caught by assertions.
7. **Iterate** — Feed failures + feedback back to `skill-creator` for improvement.

## Evaluation Metrics

| Dimension | Description |
|-----------|-------------|
| Accuracy | Output matches expected result |
| Completeness | All required components present |
| Consistency | Output stable across runs |
| Relevance | Output addresses user intent |

## Test Case Design

### Eval File Format (`evals/evals.json`)

Per the agentskills.io spec:

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "Realistic user prompt",
      "expected_output": "Human-readable description of what success looks like",
      "files": ["evals/files/input.csv"],
      "assertions": ["The output includes X"]
    }
  ]
}
```

### Field Rules

- **`expected_output`** (required): Describe the end goal/state, not implementation steps.
- **`assertions`**: Add *after* the first run to match actual behavior. Must be objective, verifiable, non-brittle.
- **`files`**: Optional — array of file paths the eval needs as input context.
  Create these files under `evals/` before running. Do NOT embed inline content.

### Assertion Quality

- **Good**: `"Output is valid JSON"`, `"Includes ≥3 recommendations"`.
- **Weak**: `"Output is good"` (vague), `"Uses exact phrase X"` (brittle).
- Remove always-pass assertions (inflate score) or always-fail ones (broken).
- Use scripts for mechanical checks; reserve subjective qualities for human review.

## Workspace Structure

```
skill-workspace/
└── iteration-N/
    ├── eval-<name>/
    │   ├── with_skill/
    │   │   ├── outputs/       # Skill output artifacts
    │   │   ├── timing.json    # { total_tokens, duration_ms }
    │   │   └── grading.json   # Assertion results
    │   └── without_skill/
    │       ├── outputs/
    │       ├── timing.json
    │       └── grading.json
    └── benchmark.json
```

## Grading (`grading.json`)

```json
{
  "assertion_results": [
    {
      "text": "Assertion text from eval",
      "passed": true,
      "evidence": "Direct quote or reference from output"
    }
  ],
  "summary": {
    "passed": 3,
    "failed": 1,
    "total": 4,
    "pass_rate": 0.75
  }
}
```

**Rules:**
- Require concrete evidence for `PASS`. Deny benefit of the doubt.
- Use semantic grading (LLM) for qualitative assertions.
- Use verification scripts for mechanical checks (JSON validity, counts).

## Timing Capture (`timing.json`)

Save immediately after each run:

```json
{
  "total_tokens": 3800,
  "duration_ms": 45000
}
```

## Benchmarking (`benchmark.json`)

```json
{
  "run_summary": {
    "with_skill": {
      "pass_rate": { "mean": 0.83, "stddev": 0.06 },
      "time_seconds": { "mean": 45.0, "stddev": 12.0 },
      "tokens": { "mean": 3800, "stddev": 400 }
    },
    "without_skill": { "...": "..." },
    "delta": {
      "pass_rate": 0.50,
      "time_seconds": 13.0,
      "tokens": 1700
    }
  }
}
```

**Analysis:**
- Evaluate `delta`: trade-off between cost (time/tokens) and value (pass rate).
- High `stddev` → flaky evals or ambiguous skill instructions.
- Investigate time/token outliers via execution transcripts.

## Human Review (`feedback.json`)

Save actionable feedback per eval directory. Catches:
- Unasserted issues.
- Technically correct but unhelpful outputs.
- Outputs that miss the user's intent.

```json
{
  "iteration-1": "Assertions pass but output is too verbose. Cut preamble."
}
```

## Iteration Loop

1. Feed failed assertions + human feedback + current `SKILL.md` to improve.
2. Generalize fixes — avoid narrow patches. Explain the "why".
3. Bundle repeated helper logic into `scripts/`.
4. Apply changes in a new `iteration-N/` directory.
5. Grade, aggregate, and review. Repeat until feedback is empty or plateau.

## Reporting Format

```
## Evaluation Results

### Summary
- Total: N
- Pass: M (X%)
- Fail: F (Z%)
- Delta pass rate: +Y%

### Failed Cases
[Analysis of each failure]

### Benchmark Delta
- Pass rate: +X%
- Time: ±Y seconds
- Tokens: ±Z

### Human Feedback
[Summary of review notes]

### Recommendations
[Actionable improvements back to skill-creator]
```

## References

- `skill-creator` — Creates skills; delegates evaluation here.
- `agents-docs/SKILLS.md` — Project skill authoring guide.
- [agentskills.io/skill-creation/evaluating-skills](https://agentskills.io/skill-creation/evaluating-skills) — Official eval guide.
