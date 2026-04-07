# AGENTS.md

## Purpose

This repository builds `d.o. EPUB Studio`, a production-grade EPUB reading and editorial workspace with gated access, offline reading, comments, highlights, and secure distribution.

## Mandatory working style

- Read before write.
- Plan first, then execute.
- Use TRIZ-first for all non-trivial tasks.
- Identify contradictions → resolve with TRIZ principles → then design.
- Keep ADRs and phase plans in `plans/`.
- Verify every important architectural decision before implementation.
- Use analysis swarm mindset when reviewing key changes:
  - methodical validator
  - rapid challenger
  - skeptical reviewer
- Do not update source-of-truth documentation until implementation is verified.

## Hard Rule

If a task involves architecture, permissions, offline sync, or EPUB rendering:
- STOP
- Run `triz-analysis` first
- Then run `triz-solver`
- Update `plans/` before any code

No exceptions.

## Constraints

- Max 500 LOC per source file.
- No hardcoded secrets.
- No hardcoded environment-specific URLs.
- No silent failures.
- No `any` unless justified and isolated.
- No skipping tests for core permission, sync, or auth flows.
- No direct public file URLs for private books.
- No unsafe EPUB HTML rendering.
- Use atomic git commit after every todo / task

## Architecture rules

- Store EPUB files in object storage, not as primary Turso blobs.
- Turso stores app state, permissions, progress, comments, highlights, and audit logs.
- Browser stores offline state first; sync is explicit and resilient.
- Signed URLs must be short-lived.
- Access validation must happen in the app backend.
- Annotation anchors must use robust locators, not raw DOM offsets alone.

## Configuration rules

- Use `wrangler.jsonc` for new Worker projects.
- Do not use a single generic `.env` as the main project config model.
- For `apps/worker`, use `wrangler.jsonc`, `wrangler secret put`, and `.dev.vars` for local development.
- For `apps/web`, use `.env.local` only for safe browser-visible values.
- Never expose Turso auth tokens or signing secrets to the frontend.
- Prefer Cloudflare bindings for R2 over raw object storage credentials.
- Use Turso CLI for provisioning and admin tasks, not as a replacement for Worker runtime configuration.
- Commit only example config files, never live secret files.

## Coding rules

- TypeScript everywhere by default.
- Zod for validation at boundaries.
- Zustand for client state.
- Vitest for unit and integration tests.
- Playwright for end-to-end tests.
- Tailwind for styling.
- Prefer pure functions for domain logic.
- Keep service interfaces small and explicit.
- Use dependency injection where it simplifies testing.
- Create test data builders for grants, books, comments, and sessions.

## Security rules

- Hash passwords using a strong KDF.
- Sanitize all rendered EPUB content.
- Validate file type and size on upload.
- Log permission grants, revocations, and access-sensitive changes.
- Use audit logs for admin actions.
- Avoid user enumeration in auth responses.
- Revoke sessions on permission revocation.

## Delivery rules

A task is complete only when:
- plan updated if needed
- implementation done
- lint passes
- typecheck passes
- tests pass
- build passes
- docs updated if behavior changed

## Quality Gate

Run before every commit. Fix all errors.

```bash
./scripts/quality_gate.sh
```

Skip tests with `SKIP_TESTS=true ./scripts/quality_gate.sh`.

## Pre-Existing Issues Rule

**Always fix pre-existing warnings and issues discovered during any task**, not just the specific task you were asked to do. This applies to:

- Skill reference link errors
- Missing skill symlinks
- Lint/type errors
- Broken references in SKILL.md files
- Configuration warnings

When analyzing issues, research deeply to understand root causes and interdependencies before applying fixes.

## Available Skills

Skills live in `.agents/skills/`. Run structure check with:
```bash
python3 .agents/skills/skill-evaluator/scripts/check_structure.py
```

Run `./scripts/setup-skills.sh` after cloning to create symlinks for Claude Code, Gemini CLI, and Qwen Code.

| Skill | Purpose |
|-------|---------|
| `triz-analysis` | Identify contradictions before design |
| `triz-solver` | Resolve contradictions after analysis |
| `skill-creator` | Create new skills with evals |
| `skill-evaluator` | Evaluate skill quality |
| `learn` | Capture non-obvious session learnings |
| `memory-context` | Semantic retrieval of past work (requires csm CLI) |
| `cloudflare-worker-api` | Cloudflare Worker patterns |
| `turso-schema-migrations` | Turso DB migration patterns |
| `code-review-assistant` | Automated code review with PR analysis |
| `testing-strategy` | Test planning, Vitest, Playwright, coverage |
| `security-code-auditor` | Security audits on EPUB Studio code |
| `shell-script-quality` | Lint and test shell scripts (ShellCheck, BATS) |
| `code-quality` | Code review, refactoring, smell detection |
| `anti-ai-slop` | Audit UI/UX/copy to avoid generic AI aesthetic |
| `parallel-execution` | Parallel agent coordination for throughput |
| `task-decomposition` | Break down complex tasks into atomic goals |

## Reference Docs

See `agents-docs/` for detailed reference documentation:
- `agents-docs/WORKFLOW.md` - Atomic commit, pre-existing issue resolution, post-task learning
- `agents-docs/SKILLS.md` - Skill authoring guide
- `agents-docs/CONTEXT.md` - Context engineering and back-pressure
- `agents-docs/HOOKS.md` - Pre/post tool hooks
- `agents-docs/SUB-AGENTS.md` - Sub-agent patterns

## Post-Task Learning

After non-trivial work: run the `learn` skill or append non-obvious discoveries to the nearest relevant `AGENTS.md`. Capture only: hidden file relationships, surprising execution behavior, undocumented commands, fragile config, files that must change together. Never write: obvious facts, duplicates, verbose explanations.

## Recent Project-Wide Learnings

- **Skills**: Imported skill-creator/evaluator from d-o-hub/github-template-ai-agents, added evals and references. All 8 skills now pass structure validation.
- **Skill Format**: Reference files use backticks, no @ prefix (`reference/filename.md`), no markdown links.
- **Template PR #133**: memory-context skill requires `cargo install chaotic_semantic_memory --features cli`
- **Template Import**: Imported quality gate scripts, skill validation, dependabot, PR template, pre-commit hooks, and agents-docs from d-o-hub/github-template-ai-agents. Added shell-script-quality, code-quality, anti-ai-slop, parallel-execution skills.
- **Template Sync**: Imported .gitattributes (line endings, linguist), markdownlint.toml, .pre-commit-config.yaml (markdownlint hook), .ignore, and updated quality_gate.sh with git hooks and GitHub Actions SHA validation.
