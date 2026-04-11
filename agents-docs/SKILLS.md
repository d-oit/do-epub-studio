# Skills - Authoring Guide

> Reference doc - not loaded by default. Follows the [agentskills.io specification](https://agentskills.io/specification).

## External Reference

For UI/UX design tokens and optimization patterns, see [do-gemini-ui-ux-skill](https://github.com/d-oit/do-gemini-ui-ux-skill/tree/main/):

- `docs/design/` - design system (4 modes, typography, colors, layout)
- `.agents/skills/ui-ux-optimize/SKILL.md` - tokenize workflow
- `src/index.css` - base styles with overflow handling

## Canonical Location

All skills live in `.agents/skills/` (the canonical source).
Claude Code, Gemini CLI, and Qwen Code use symlinks; OpenCode reads directly:

```
.agents/skills/<name>/          <- CANONICAL (all agents read from here)
.claude/skills/<name>           -> symlink -> ../../.agents/skills/<name>
.gemini/skills/<name>           -> symlink -> ../../.agents/skills/<name>
.qwen/skills/<name>             -> symlink -> ../../.agents/skills/<name>
```

Run `./scripts/setup-skills.sh` after cloning to create symlinks.
Run `./scripts/validate-skills.sh` to verify integrity.
Run `./scripts/eval-skills.sh` to evaluate skill quality.

## Why .agents/ as Canonical?

`.claude/` is Claude Code-specific. `.agents/` is tool-agnostic - it works when you
add Gemini CLI, OpenCode, Codex, or any future harness without moving files.

## Progressive Disclosure

Three levels (per agentskills.io):

- **L1 (Metadata)** — `name` + `description` from frontmatter (~100 tokens). Always loaded for routing.
- **L2 (Instructions)** — Full `SKILL.md` body (< 5,000 tokens). Loaded only when the agent activates the skill.
- **L3 (Resources)** — Files in `references/`, `scripts/`, `assets/`. Loaded on-demand when L2 instructions reference them.

Skills prevent instruction budget exhaustion: a skill's `SKILL.md` is loaded only
when the agent decides it is needed. Do not pre-load all skills at session start.

## Directory Structure

```
.agents/skills/
└── skill-name/
    ├── SKILL.md          # Required: frontmatter + instructions (≤ 250 lines)
    ├── references/       # Optional: on-demand documentation
    ├── scripts/          # Optional: executable scripts the agent can run
    ├── assets/           # Optional: templates, examples, static resources
    └── evals/            # Optional: eval test cases (evals/evals.json)
```

## SKILL.md Template

```markdown
---
name: skill-name
description: >
  Imperative description of what the skill does and when to trigger it.
  Front-load the primary use case in the first 80 characters.
category: coordination|quality|documentation|workflow|research|knowledge-management
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Skill Title

One-sentence summary. Clarify scope vs related skills if overlap exists.

## When to Use

- Activate when: [specific triggers]
- NOT for: [out-of-scope scenarios handled by other skills]

## Instructions

[Concise, step-by-step procedural instructions]

## Reference Files

- `references/guide.md` - [when to read]
- `scripts/run.sh` - [what it does]
```

## Frontmatter Fields

| Field           | Required    | Constraints                                                                            |
| --------------- | ----------- | -------------------------------------------------------------------------------------- |
| `name`          | Yes         | 1-64 chars. Lowercase + hyphens only. Must match directory name.                       |
| `description`   | Yes         | 1-1024 chars. Front-load trigger use case. Aim for ≤200 chars for reliable L1 routing. |
| `category`      | Yes         | One of: coordination, quality, documentation, workflow, research, knowledge-management |
| `allowed-tools` | Yes         | Space-delimited list of pre-approved tools. Restrict to minimum required.              |
| `version`       | Recommended | Semantic version (e.g., "1.0.0"). Only one version field allowed.                      |
| `license`       | No          | License name or reference to bundled license file.                                     |
| `compatibility` | No          | Max 500 chars. Environment requirements (e.g., "Requires csm CLI").                    |
| `metadata`      | No          | Arbitrary key-value map. Use unique keys to prevent conflicts.                         |

## Description Optimization

1. **Use imperative phrasing** — "Use this skill when..." not "This skill does..."
2. **Front-load the primary trigger** — First 80 characters matter most for L1 routing.
3. **Include natural-language trigger phrases** — What users actually type.
4. **Keep it ≤200 chars** — Effectively capped at ~250 chars in listings.
5. **Be specific about scope** — Mention what this skill does NOT handle.

## Eval Format (`evals/evals.json`)

Per the agentskills.io specification — uses `expected_output`, not trigger matching:

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

- **`expected_output`** (required): Describe the end goal/state.
- **`assertions`**: Add _after_ the first run. Must be objective and verifiable.
- **`files`**: String array of file paths under `evals/`. Create actual files; do NOT embed content inline.
- Start with 2-3 evals; grow to 6-10 for critical skills.
- Run `./scripts/eval-skills.sh` to validate eval format.

### Evaluation Workflow

1. **Baseline**: Run each eval **without** the skill (or previous version).
2. **With skill**: Run each eval with the skill active.
3. **Grade**: Score assertions, save `grading.json` with pass/fail + evidence.
4. **Benchmark**: Aggregate pass rate, time, token deltas into `benchmark.json`.
5. **Human review**: Save actionable feedback in `feedback.json`.
6. **Iterate**: Feed failures + feedback back for improvement.

## Rules

- `SKILL.md` ≤ 250 lines — detailed content goes in `references/`.
- Include executable scripts so the agent can validate directly.
- Cite sources as backtick-wrapped relative paths (e.g., `` `references/guide.md` ``).
- No `@` prefix on reference paths. No markdown links in References sections.
- One skill, one verb — split when handling different trigger patterns.
- Do not duplicate content already in `AGENTS.md`.
- No `should_trigger` field in evals — use `expected_output` per spec.
- No duplicate `version` fields in frontmatter.

## Agent vs Skill

| Use a Skill                       | Use a Sub-Agent                   |
| --------------------------------- | --------------------------------- |
| Reusable reference knowledge      | Complex multi-step execution      |
| Main agent executes with guidance | Needs isolated context window     |
| No context isolation needed       | Different tool access than parent |

## Anti-Patterns

- One huge orchestration skill doing everything (fills context fast).
- Duplicate content across skills (split by verb, not by domain).
- Descriptions over 250 characters (truncated in L1 routing).
- Auto-generating `SKILL.md` without human review.
- Eval assertions that are vague ("looks good") or brittle (exact text matching).
- Deeply nested reference files (keep to one level from `SKILL.md`).
