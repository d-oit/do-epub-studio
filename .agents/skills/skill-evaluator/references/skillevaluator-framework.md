# SkillEvaluator Framework (NVIDIA Multi-Tier Architecture)

The skill evaluation workflow integrates principles from the NVIDIA SkillEvaluator multi-tier evaluation framework for agent skills.

## Evaluation Tiers

### Tier 1: Offline Validation & Security Gates
- **Purpose**: Verifies that the skill is well-formed, valid, and secure before execution.
- **Checks**:
  - Deterministic schema validation (`validate-skill-format.sh`).
  - Line length constraints (`SKILL.md` ≤ 250 lines).
  - Frontmatter metadata checks (imperative phrasing, name/description cap ≤ 200 chars).
  - Security scanning (checking for un-sanitized script execution or secret exposure).

### Tier 2: Deduplication & Semantic Overlap Detection
- **Purpose**: Ensures skills do not duplicate existing guidance within the codebase or across skills.
- **Checks**:
  - Verifies explicit delegation boundaries (e.g., `frontend-design` vs `reader-ui-ux` vs `accessibility-auditor`).
  - Ensures concise progressive disclosure without duplicating `AGENTS.md` or `DESIGN.md`.

### Tier 3: Live Agent Evaluation & Skill Lift
- **Purpose**: Measures whether activating the skill provides measurable performance improvement ("Skill Lift").
- **Evaluated Dimensions**:
  1. **Security**: Hardened against anti-patterns, XSS, and dangerous defaults.
  2. **Correctness**: Output matches specified design tokens, layout patterns, and code specs.
  3. **Discoverability**: High L1 routing accuracy based on trigger keywords in description.
  4. **Effectiveness**: Delivers complete, working UI components and layout plans.
  5. **Efficiency**: Optimizes token usage and execution time during generation.

## Test Case Structure (`evals/evals.json`)

All skill evaluation test cases must conform to Tier 1 and Tier 3 requirements:

```json
{
  "skill_name": "skill-name",
  "evals": [
    {
      "id": 1,
      "prompt": "Realistic user prompt testing specific skill capability",
      "expected_output": "Detailed description of expected end state",
      "assertions": [
        "Objective assertion 1",
        "Objective assertion 2"
      ]
    }
  ]
}
```
