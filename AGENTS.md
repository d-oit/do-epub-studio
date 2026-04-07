# AGENTS.md

## Purpose

This repository builds `do EPUB Studio`, a production-grade EPUB reading and editorial workspace with gated access, offline reading, comments, highlights, and secure distribution.

## Standard Workflow

**Every task follows this sequence:**

```
1. Read → Understand context before any action
2. Plan → Break into atomic steps, update plans/ if needed
3. Execute → Implement with small, verifiable changes
4. Verify → Run quality gate, fix all errors
5. Commit → Atomic commit with meaningful message
6. Learn → Capture non-obvious discoveries (MANDATORY for non-trivial tasks)
```

**Atomic commit rules:**
- One logical change per commit
- Meaningful commit message: `type(scope): description`
- Run `learn` skill after non-trivial work
- Push immediately after commit

## Hard Rules

**TRIZ-first for architecture:**
- If a task involves architecture, permissions, offline sync, or EPUB rendering:
  1. STOP
  2. Run `triz-analysis`
  3. Run `triz-solver`
  4. Update `plans/` before any code

**Learnings mandate:**
- After every non-trivial task, run the `learn` skill
- Capture: hidden relationships, surprising behavior, undocumented commands, fragile config
- Never capture: obvious facts, duplicates, verbose explanations

No exceptions to these rules.

## Constraints

- Max 500 LOC per source file.
- No hardcoded secrets.
- No hardcoded environment-specific URLs.
- No silent failures.
- No `any` unless justified and isolated.
- No skipping tests for core permission, sync, or auth flows.
- No direct public file URLs for private books.
- No unsafe EPUB HTML rendering.

## Architecture Rules

- Store EPUB files in object storage, not as primary Turso blobs.
- Turso stores app state, permissions, progress, comments, highlights, and audit logs.
- Browser stores offline state first; sync is explicit and resilient.
- Signed URLs must be short-lived.
- Access validation must happen in the app backend.
- Annotation anchors must use robust locators, not raw DOM offsets alone.

## Configuration Rules

- Use `wrangler.jsonc` for new Worker projects.
- Do not use a single generic `.env` as the main project config model.
- For `apps/worker`, use `wrangler.jsonc`, `wrangler secret put`, and `.dev.vars` for local development.
- For `apps/web`, use `.env.local` only for safe browser-visible values.
- Never expose Turso auth tokens or signing secrets to the frontend.
- Prefer Cloudflare bindings for R2 over raw object storage credentials.
- Use Turso CLI for provisioning and admin tasks, not as a replacement for Worker runtime configuration.
- Commit only example config files, never live secret files.

## Coding Rules

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

## Security Rules

- Hash passwords using a strong KDF.
- Sanitize all rendered EPUB content.
- Validate file type and size on upload.
- Log permission grants, revocations, and access-sensitive changes.
- Use audit logs for admin actions.
- Avoid user enumeration in auth responses.
- Revoke sessions on permission revocation.

## Delivery Rules

A task is complete only when:
- plan updated if needed
- implementation done
- lint passes
- typecheck passes
- tests pass
- build passes
- docs updated if behavior changed
- learnings captured (if non-trivial)

## Quality Gate

Run before every commit. Fix all errors.

```bash
./scripts/quality_gate.sh
```

Skip tests with `SKIP_TESTS=true ./scripts/quality_gate.sh`.

## Pre-Existing Issues Rule

**Always fix pre-existing warnings and issues discovered during any task**, not just the specific task you were asked to do:

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

Run `./scripts/setup-skills.sh` after cloning to create symlinks.

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `triz-analysis` | Identify contradictions before design | Architecture, permissions, offline, EPUB |
| `triz-solver` | Resolve contradictions after analysis | After triz-analysis |
| `learn` | Capture non-obvious session learnings | After every non-trivial task |
| `skill-creator` | Create new skills with evals | Creating new skills |
| `skill-evaluator` | Evaluate skill quality | Validating skills |
| `cloudflare-worker-api` | Cloudflare Worker patterns | Worker development |
| `turso-schema-migrations` | Turso DB migration patterns | Database schema |
| `code-review-assistant` | Automated code review | PR review |
| `testing-strategy` | Test planning and coverage | Test design |
| `security-code-auditor` | Security audits | Security review |
| `shell-script-quality` | Shell script lint/test | Bash/sh scripts |
| `code-quality` | Code review and refactoring | Code quality |
| `anti-ai-slop` | Audit UI/UX/copy | UI review |
| `parallel-execution` | Parallel agent coordination | Complex tasks |
| `task-decomposition` | Break down complex tasks | Large features |
| `memory-context` | Semantic retrieval of past work | Recall previous work |

## Skill Reference Format

**Always use this format for skill references:**
- Skill names in backticks: `` `triz-analysis` ``
- No @ prefix
- Reference files in backticks: `` `reference/filename.md` ``
- No markdown links for internal references

## Reference Docs

See `agents-docs/` for detailed reference:
- `agents-docs/WORKFLOW.md` - Atomic commit, pre-existing issue resolution, post-task learning
- `agents-docs/SKILLS.md` - Skill authoring guide
- `agents-docs/CONTEXT.md` - Context engineering and back-pressure
- `agents-docs/HOOKS.md` - Pre/post tool hooks
- `agents-docs/SUB-AGENTS.md` - Sub-agent patterns

## Recent Project-Wide Learnings

- **Skills**: Imported skill-creator/evaluator from d-o-hub/github-template-ai-agents, added evals and references. All 8 skills now pass structure validation.
- **Skill Format**: Reference files use backticks, no @ prefix (`` `reference/filename.md` ``), no markdown links.
- **Template PR #133**: memory-context skill requires `cargo install chaotic_semantic_memory --features cli`
- **Template Import**: Imported quality gate scripts, skill validation, dependabot, PR template, pre-commit hooks, and agents-docs from d-o-hub/github-template-ai-agents.
- **Template Sync**: Imported .gitattributes (line endings, linguist), markdownlint.toml, .pre-commit-config.yaml (markdownlint hook), .ignore, and updated quality_gate.sh.
- **Learnings Mandate**: All non-trivial tasks MUST run `learn` skill before commit to capture discoveries.
