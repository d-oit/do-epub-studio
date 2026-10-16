# SKILL_TEMPLATE.md

Canonical starting point for `.agents/skills/<name>/SKILL.md`. Copy the
skeleton below, replace every `<placeholder>`, and delete this header section
from the new skill.

Enforced by `scripts/validate-skill-format.sh` (quality gate + pre-commit):
frontmatter fields and their constraints, `name` matching the directory, the
250-line cap, and the two required sections `## Rationalizations` and
`## Red Flags`.

## Skeleton

```markdown
---
version: "1.0.0"
name: <skill-name>
description: >
  <One-line purpose. Include the trigger phrases this skill activates on, e.g.
  "Use when X, Y, or Z; not for W.">
category: <coordination|quality|documentation|workflow|research|knowledge-management>
allowed-tools: Read Write Edit Bash
license: MIT
---

# <Skill Title>

<One paragraph: what this skill does and when it applies.>

## When to Use

- <Trigger / task shape>

## When NOT to Use

- <Explicit exclusion to prevent over-triggering>

## <Core Content>

<Workflow, rules, commands, tables, examples.>

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "<Plausible excuse an agent would make in this skill's domain>" | <The concrete counter-fact: real rule, command, file, or convention from this skill> |
| "<Another excuse>" | <Another concrete counter-fact> |

## Red Flags

- [ ] <Observable, checkable condition that predicts failure>
- [ ] <Observable, checkable condition that predicts failure>
- [ ] <Observable, checkable condition that predicts failure>

## References

- `<references/file.md>` - <what it contains>
```

## Required-section rules

- `## Rationalizations` MUST be a table with the exact header
  `| Rationalization | Reality |` and at least 2 data rows. Each row pairs an
  excuse with the skill's own rule that defeats it — never generic filler.
- `## Red Flags` MUST be a `- [ ]` checklist with at least 3 items. Each item
  is a pre-failure condition someone can observe, not advice.
- Place both sections immediately before the final `References`,
  `Related Skills`, `Integration`, or `Summary` section; otherwise append them
  at the end of the file.
- Keep the whole file at or under 250 lines.
