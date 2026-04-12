# Scripts

Operational scripts for `do EPUB Studio`. All scripts assume execution from the repository root.

## Quick Start

```bash
# Install git hooks (run once after cloning)
./scripts/install-hooks.sh

# Run full quality gate
./scripts/quality_gate.sh

# Atomic commit workflow
./scripts/atomic-commit/run.sh --message "feat(reader): add annotation sync"
```

## Quality Gate Scripts

| Script | Purpose | Dependencies |
|--------|---------|-------------|
| `quality_gate.sh` | Runs all checks: lint, typecheck, test, validate skills/links/format | pnpm, shellcheck (optional), markdownlint (optional) |
| `pre-commit-hook.sh` | Standalone pre-commit wrapper around quality gate | quality_gate.sh |
| `validate-skills.sh` | Checks skill symlinks and SKILL.md existence | none |
| `validate-skill-format.sh` | Validates SKILL.md frontmatter per agentskills.io spec | none |
| `validate-links.sh` | Validates reference links in SKILL.md files | perl (macOS fallback for realpath) |
| `validate-git-hooks.sh` | Detects global git hooks overriding local hooks | git |
| `validate-github-actions-shas.sh` | Detects placeholder SHAs in workflow files | none (gh CLI optional) |
| `eval-skills.sh` | Evaluates skill quality via check_structure.py | python3 |
| `setup-skills.sh` | Creates symlinks for CLI skill folders | none |

## Atomic Commit Workflow

Orchestrated via `scripts/atomic-commit/run.sh`. Each phase is an independent script:

| Phase | Script | Description |
|-------|--------|-------------|
| 1 | `validate.sh` | Quality gate, secret scan, branch check |
| 2 | `commit.sh` | Conventional commit creation (staged changes only) |
| 3 | `push.sh --check-only` | Pre-push conflict detection |
| 4 | `push.sh` | Push to origin |
| 5 | `create-pr.sh` | Create GitHub PR |
| 6 | `verify.sh` | Wait for CI checks with timeout |

## Git Hooks

Source hooks live in `scripts/hooks/`. Install them with:

```bash
./scripts/install-hooks.sh
```

| Hook | Purpose |
|------|---------|
| `pre-commit` | Runs quality gate before each commit |
| `commit-msg` | Validates conventional commit format |
| `pre-push` | Blocks direct pushes to main/master |

## Database Scripts

| Script | Purpose | Dependencies |
|--------|---------|-------------|
| `bootstrap.mjs` | Create local Turso DB + auth token (idempotent) | turso CLI |
| `db-migrate-local.mjs` | Apply SQL migrations to local DB (idempotent) | turso CLI |

## Utility Scripts

| Script | Purpose |
|--------|---------|
| `install-hooks.sh` | Copy hooks to `.git/hooks/` with dedup |
| `validate-git-hooks.sh` | Check for global hooks overriding local |
| `validate-github-actions-shas.sh` | Detect placeholder SHAs in workflows |

## Shared Libraries

Located in `scripts/lib/`:

| File | Purpose |
|------|---------|
| `colors.sh` | TTY-aware ANSI color definitions |
| `logging.sh` | Unified log/error/success/warn helpers |
| `repo_root.sh` | Portable REPO_ROOT detection |
| `lint_cache.sh` | File-hash cache to skip unchanged lints |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SKIP_TESTS` | `false` | Skip test checks in quality gate |
| `FORCE_COLOR` | auto (TTY) | Force color output (`0` to disable) |
| `ATOMIC_COMMIT_TIMEOUT` | `1800` | CI check timeout in seconds |
| `ATOMIC_COMMIT_BASE_BRANCH` | `main` | Target branch for PRs |
| `ATOMIC_COMMIT_NO_ROLLBACK` | `0` | Disable rollback on failure |
| `ATOMIC_COMMIT_NO_FORCE_ROLLBACK` | `1` | Disable force-push rollback (safe default) |
| `TURSO_DB_NAME` | `do-epub-studio-local` | Local Turso DB name |
| `TURSO_MIGRATIONS_DIR` | `packages/schema/migrations` | SQL migrations path |
| `MAX_SKILL_LINES` | `250` | Max lines per SKILL.md |
