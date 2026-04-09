---
version: "1.0.0"
name: skill-creator
description: >
  Create and edit skills. Activate for skill authoring, frontmatter optimization,
  or restructuring existing skills per the agentskills.io spec.
category: coordination
allowed-tools: Read Write Edit
license: MIT
---

# Skill Creator

Create and improve skills following the Agent Skills specification.
Delegates evaluation to the `skill-evaluator` skill.

## Core Loop

1. **Capture intent** — What should the skill do? When should it trigger?
2. **Write draft** — Create `SKILL.md` with frontmatter and instructions.
3. **Validate format** — Run `./scripts/validate-skill-format.sh`.
4. **Create evals** — Write `evals/evals.json` with 2-3 realistic prompts and `expected_output` descriptions.
5. **Evaluate** — Delegate to `skill-evaluator` for grading, benchmarking, and human review.
6. **Iterate** — Improve based on feedback until satisfied.

## Skill Specification

### Directory Structure

```
skill-name/
├── SKILL.md          # Required: metadata + instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: on-demand documentation
├── assets/           # Optional: templates, resources
└── evals/            # Optional: test cases for skill-evaluator
```

### Frontmatter Fields

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Yes | Max 64 chars. Lowercase letters, numbers, hyphens only. Must match directory name. |
| `description` | Yes | Max 1024 chars. Describes what the skill does AND when to use it. Aim for ≤200 chars for reliable L1 routing. |
| `category` | Yes | One of: coordination, quality, documentation, workflow, research, knowledge-management |
| `version` | Recommended | Semantic version (e.g., "1.0.0"). |
| `license` | No | License name or reference to bundled license file. |
| `compatibility` | No | Max 500 chars. Environment requirements. |
| `metadata` | No | Arbitrary key-value mapping. |
| `allowed-tools` | No | Space-delimited list of pre-approved tools (experimental). |

### SKILL.md Body

- Keep under **250 lines** (agentskills.io allows 500; we enforce 250).
- Use progressive disclosure: move detailed content to `references/`.
- Include step-by-step instructions, examples, and common edge cases.
- Reference files with relative paths from skill root, one level deep.

## Optimizing Skill Descriptions

### Core Writing Principles

1. **Use imperative phrasing** — "Use this skill when..." not "This skill does..."
2. **Focus on user intent** — Describe what the user is trying to achieve.
3. **Be pushy about triggers** — Explicitly list contexts where the skill applies.
4. **Keep it concise** — ≤200 chars for reliable L1 routing (effectively capped at ~250).

### Trigger Keywords

- Front-load the primary trigger scenario in the first 80 characters.
- Include natural-language phrases users will actually type.
- Avoid vague labels like "quality" without context.

## Anti-Patterns

- One skill doing multiple unrelated verbs (split into separate skills).
- Duplicating content already in `AGENTS.md` or project docs.
- Descriptions over 250 characters (truncated in L1 routing).
- Deeply nested reference files (keep to one level from `SKILL.md`).
- Auto-generating `SKILL.md` without human review.

## References

- `agents-docs/SKILLS.md` — Project skill authoring guide.
- [agentskills.io/specification](https://agentskills.io/specification) — Official spec.
- `skill-evaluator` — Delegate evaluation testing here.
