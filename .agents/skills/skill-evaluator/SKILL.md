---
name: skill-evaluator
description: Evaluate skill output quality and measure skill performance. Use when users want to assess skill quality, run benchmarks, compare skill versions, or validate skill behavior against expected outcomes.
license: MIT
---

# Skill Evaluator

Evaluate and measure skill performance following structured evaluation methodologies.

## Core Loop

1. **Define metrics** - What defines quality for this skill?
2. **Create test cases** - Realistic prompts covering edge cases
3. **Run evaluation** - Execute skill on test cases
4. **Score results** - Rate outputs against defined metrics
5. **Analyze failures** - Identify patterns in poor outputs
6. **Report findings** - Summarize with actionable insights

---

## Evaluation Metrics

### Quality Dimensions

| Dimension | Description |
|-----------|-------------|
| Accuracy | Output matches expected result |
| Completeness | All required components present |
| Consistency | Output stable across runs |
| Relevance | Output addresses user intent |
| Safety | No harmful or inappropriate content |

### Scoring Scale

- **Pass (1)**: Meets all criteria
- **Partial (0.5)**: Meets some criteria
- **Fail (0)**: Does not meet criteria

---

## Test Case Design

### Structure

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's task prompt",
      "expected_output": "Description of expected result",
      "files": [],
      "assertions": ["The output includes X"]
    }
  ]
}
```

### Guidelines

- Cover happy path and edge cases
- Include negative test cases
- Vary prompt complexity
- Test implicit vs explicit intent

---

## Reporting

### Output Format

```
## Evaluation Results

### Summary
- Total: N
- Pass: M (X%)
- Partial: P (Y%)
- Fail: F (Z%)

### Failed Cases
[Analysis of each failure]

### Recommendations
[Actionable improvements]
```

---

## Variance Analysis

When comparing versions:
1. Run same test suite on both versions
2. Calculate delta per test case
3. Identify statistically significant improvements
4. Report regression risks