# Project Learnings

> Aggregated non-obvious discoveries - loaded on demand via `learn` skill.

## Learnings Capture Rules

### What to Capture

- Hidden file relationships not obvious from code
- Execution paths that differ from what code appears to do
- Non-obvious config, env vars, or flags
- Misleading error messages and debugging breakthroughs
- Files that must change together
- Build/test commands not documented elsewhere
- Architectural constraints discovered at runtime

### What NOT to Capture

- Obvious documentation or standard behavior
- Duplicates of existing entries
- Verbose explanations or session-specific notes

### Scoping

| Scope           | Location                          |
| --------------- | --------------------------------- |
| Project-wide    | `agents-docs/LEARNINGS.md`        |
| Script-specific | `scripts/AGENTS.md`               |
| Skill-specific  | `.agents/skills/<name>/AGENTS.md` |
| Plan-specific   | `plans/AGENTS.md`                 |

---

## Learnings (Project-Wide)

- **Vitest**: `turbo run test` hangs if any package uses bare `vitest`; always pass `--run` so CI exits cleanly.
- **Swarm Deliverables**: `plans/analysis-*.md` assumes `analysis/SWARM_ANALYSIS.md` exists; keep that file updated after every multi-agent audit so downstream tasks find the aggregated report.
- **EPUB.js + TypeScript**: epubjs types expect non-null refs; capture in local variable before passing to `renderTo()` to avoid TS2769 errors.
- **IndexedDB getAllFromIndex**: idb's `getAllFromIndex` with boolean `false` as value fails - use `.getAll().then(filter())` instead.
- **Duplicate exports**: Don't export same function from multiple modules in a package; TS reports "has already exported a member" error.
- **Dependabot PRs + TypeScript major bumps**: TypeScript 5.9→6.0 is a major version with breaking changes. When dependabot bumps TS to a new major, PRs will fail lint until code is updated to be TS6-compatible. Merge non-TS PRs first, then manually fix TS6 issues before re-running CI.
- **UI/UX Design Tokens**: See [do-gemini-ui-ux-skill](https://github.com/d-oit/do-gemini-ui-ux-skill/tree/main/) for design system reference. Key files: `docs/design/design-system.md` (4 core modes, anti-flicker, glass-refractive), `docs/design/typography.md` (Anton/Georgia/Inter/Courier), `docs/design/color-palette.md` (semantic success/warning/error/info), `docs/design/layout.md` (container, gap, radius, HUD safe zones), `.agents/skills/ui-ux-optimize/SKILL.md` (tokenize workflow).
