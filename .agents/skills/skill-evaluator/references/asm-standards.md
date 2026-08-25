# Agent Skill Manager (asm) Standards & Attention Budget

This document outlines key practices from `asm` (Agent Skill Manager) for skill authoring, auditing, and context optimization.

## Attention Budget & Context Optimization

- **Resident vs. Body Tokens**:
  - **Resident Cost**: The frontmatter `description` is resident in the agent system prompt on every turn across supported tool providers. Keep descriptions concise (≤ 200 characters) and front-loaded with clear trigger conditions to minimize resident token bloat.
  - **Body Cost**: Full `SKILL.md` instructions and `references/` files are only loaded when the skill is activated.
- **Reference Tier (Zero Residency)**:
  - Deep reference documentation belongs in `references/*.md` loaded on-demand using progressive disclosure to maintain a minimal resident token footprint.

## Security & Metadata Validation

- **Frontmatter Fields**:
  - Requires valid `name`, concise `description`, `category`, and `allowed-tools`.
  - Prohibits un-sanitized script executions (`atob()`, hardcoded credentials, suspicious base64).
- **Multi-Provider Symlink Compatibility**:
  - Ensures skill directories in `.agents/skills/` are symlinked cleanly across all 19 supported agent providers (`.claude/`, `.qwen/`, `.gemini/`, `.opencode/`, `.jules/`, etc.).
