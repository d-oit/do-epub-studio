---
version: "1.0.0"
name: learn
description: >
  Extract non-obvious session learnings into scoped files. MANDATORY after
  every non-trivial change (AGENTS.md Tier 2 #12): capture fragile config,
  quirks, or breakthroughs in the same PR that produced them.
category: knowledge-management
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Learn

Extract non-obvious session learnings into scoped files to preserve knowledge across sessions.

## When to Use

**Mandatory** after completing any non-trivial change (AGENTS.md Tier 2 #12) —
run before opening the PR, and include the learnings in the same PR that
produced them. If nothing qualifies, state "no new learnings" in the PR
description instead of skipping silently.

## Capture Checklist

Ask after every change; answer "yes" → capture:

1. Did a file relationship surprise me (files that must change together)?
2. Did the code behave differently than it appeared to (hidden execution path)?
3. Did an error message mislead me before I found the real cause?
4. Did I use a command, flag, or env var not documented in README/AGENTS.md?
5. Did I discover a constraint only visible at runtime or in CI?

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

Place learnings in the most specific location:

- **Project-wide**: `agents-docs/LEARNINGS.md`.
- **Script-specific**: `scripts/AGENTS.md`.
- **Skill-specific**: `.agents/skills/<name>/AGENTS.md`.

### Format

- 1–3 lines per insight.
- Bulleted list in the appropriate scoped file.
- No duplicates of existing entries.

## Example

After debugging a Turso sync issue:

```markdown
## Learnings (Project-Wide)

- **Turso Sync**: Database must be open in read mode during sync operations; write locks cause intermittent failures
```

## Reference Files

- `AGENTS.md` - Root agent guidance and constraints.
- `agents-docs/LEARNINGS.md` - Project-wide learnings.
- `plans/` - ADRs and phase plans.
