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
- **Vitest coverage-v8 versioning**: `@vitest/coverage-v8` must match the installed `vitest` major version exactly. Installing v4 coverage with v1 vitest causes `Cannot read properties of undefined (reading 'reportsDirectory')` at runtime.
- **React RefObject readonly**: `React.RefObject<T>` has a readonly `current` property. Use `useRef<T | null>(initialValue)` instead when you need to mutate `.current` inside effects or event handlers.
- **react-hooks/exhaustive-deps with refs**: When capturing a ref's `.current` value inside `useEffect`, exclude the ref from the dependency array and capture the value at effect execution time. The ref itself doesn't change — only its `.current` does — so including it causes unnecessary re-runs.
- **pnpm corepack prompts**: On fresh environments, `pnpm` may prompt interactively for corepack downloads. Use `corepack enable && echo "Y" | pnpm install` for non-interactive setup.
- **Tailwind sr-only class**: `sr-only` is a built-in Tailwind utility (no config needed) — hides content visually but keeps it accessible to screen readers via `position: absolute; width/height: 1px; clip: rect(0,0,0,0)`.
- **axe-core playwright**: `@axe-core/playwright` analyzes the page at the moment of invocation. Mocked API responses must be set up before navigation for meaningful results on pages that load asynchronously.
- **AGENTS.md Workflow Sequence**: Workflow must start with learning/memory context load (step 1), not reading. Use `learn` skill or check `agents-docs/LEARNINGS.md` before touching code. This prevents re-discovering the same fragile config/tool quirks.
- **Verification Skill Selection**: Different verification tasks require specific skills: `code-quality` (file-level smells), `code-review-assistant` (PR-level diffs), `shell-script-quality` (ShellCheck/BATS), `security-code-auditor` (auth/EPUB audits), `triz-analysis`→`triz-solver` (architecture contradictions), `anti-ai-slop` (UI copy).
- **KNOWN-ISSUES.md Requirement**: Unfixable warnings must be documented with exact message, location, reason, mitigation, and date. Quality gate has no escape hatches — if a check fails, fix it or document why it cannot be fixed.
- **Markdownlint Configuration**: Requires `.markdownlint.json` with disabled rules for pre-existing styles (MD013, MD022, MD024, MD025, MD026, MD029, MD031-MD036, MD040, MD041, MD047, MD060). Use `.markdownlintignore` to exclude node_modules and .opencode/node_modules.
