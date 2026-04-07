---
name: learn
description: Extract non-obvious session learnings into scoped AGENTS.md files. Use after completing non-trivial tasks to capture insights that would otherwise be lost.
license: MIT
---

# Learn

Extract non-obvious session learnings into scoped `AGENTS.md` files to preserve knowledge across sessions.

## When to Use

Activate after completing a non-trivial task to capture insights that would otherwise be lost.

## Instructions

### What to Capture (Non-Obvious Only)

- Hidden relationships between files or scripts not obvious from code.
- Execution paths that differ from what the code appears to do.
- Non-obvious config, env vars, or flags.
- Debugging breakthroughs where error messages were misleading.
- Files that must change together (e.g., `AGENTS.md` + skill files when adding skills).
- Build/test commands not documented in README.
- Architectural constraints discovered at runtime.

### What NOT to Capture

- Obvious documentation or standard behavior.
- Duplicates of existing entries.
- Verbose explanations or session-specific notes.

### Scoping Rules

Place learnings in the most specific `AGENTS.md` file:
- **Project-wide**: Root `AGENTS.md`.
- **Script-specific**: `scripts/AGENTS.md`.
- **Skill-specific**: `.agents/skills/<name>/AGENTS.md`.

### Format

- 1–3 lines per insight in `AGENTS.md`.
- Max 150 lines total in root AGENTS.md.
- Bulleted list under a "Recent Project-Wide Learnings" or "Context" section.

## Example

After debugging a Turso sync issue:

```markdown
## Recent Project-Wide Learnings

- **Turso Sync**: Database must be open in read mode during sync operations; write locks cause intermittent failures (LESSON-001)
```

## Reference Files

- `AGENTS.md` - Root agent guidance and constraints.
- `plans/` - ADRs and phase plans.
