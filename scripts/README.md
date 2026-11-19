# Scripts

Operational scripts for `d.o.EPUB Studio`. All scripts assume execution from the repository root.

## Quick Start

```bash
# Install git hooks (run once after cloning)
./scripts/install-hooks.sh

# Run full quality gate
./scripts/quality_gate.sh

# Atomic commit workflow
./scripts/atomic-commit/run.sh --message "feat(reader): add annotation sync" --body "WHY"
```

## Quality Gate Scripts

| Script                     | Purpose                                                                                                                                                                                                       | Dependencies                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `quality_gate.sh`          | Runs all checks: lint, typecheck, test, validate skills/links/format, **markdownlint** (default), **`validate-workflows.sh` → actionlint + zizmor** (default), `run-impeccable.sh` (warnings only by default) | pnpm, shellcheck (optional), markdownlint (optional) |
| `validate-skills.sh`       | Checks skill symlinks and SKILL.md existence                                                                                                                                                                  | none                                                 |
| `validate-skill-format.sh` | Validates SKILL.md frontmatter per agentskills.io spec                                                                                                                                                        | none                                                 |
| `validate-links.sh`        | Validates reference links in SKILL.md files                                                                                                                                                                   | perl (macOS fallback for realpath)                   |
| `validate-workflows.sh`    | Validates GitHub Actions workflows (actionlint + zizmor, SHA pinning)                                                                                                                                         | actionlint, zizmor                                   |
| `validate-git-hooks.sh`    | Detects global git hooks overriding local hooks                                                                                                                                                               | git                                                  |
| `validate-shas.sh`         | Detects placeholder SHAs in workflow files                                                                                                                                                                    | none (gh CLI optional)                               |
| `run-impeccable.sh`        | Wraps `npx impeccable detect --json` for the quality gate (ADR-111)                                                                                                                                           | npx, jq, impeccable                                  |
| `check-bundle-budget.mjs`  | Enforces per-file gzip limits, raw initial-load route caps (static imports + CSS), baseline deltas, and deploy-file ceilings (180/30/165 KB gzip budgets)                                                     | node                                                 |
| `eval-skills.sh`           | Evaluates skill quality via check_structure.py                                                                                                                                                                | python3                                              |
| `setup-skills.sh`          | Creates symlinks for CLI skill folders                                                                                                                                                                        | none                                                 |

## Atomic Commit Workflow

Orchestrated via `scripts/atomic-commit/run.sh`. Each phase is an independent script:

| Phase | Script                 | Description                                        |
| ----- | ---------------------- | -------------------------------------------------- |
| 1     | `validate.sh`          | Quality gate, secret scan, branch check            |
| 2     | `commit.sh`            | Conventional commit creation (staged changes only) |
| 3     | `push.sh --check-only` | Pre-push conflict detection                        |
| 4     | `push.sh`              | Push to origin                                     |
| 5     | `create-pr.sh`         | Create GitHub PR                                   |
| 6     | `verify.sh`            | Wait for CI checks with timeout                    |

## Git Hooks

Source hooks live in `scripts/hooks/`. Install them with:

```bash
./scripts/install-hooks.sh
```

| Hook         | Purpose                              |
| ------------ | ------------------------------------ |
| `pre-commit` | Runs quality gate before each commit |
| `commit-msg` | Validates conventional commit format |
| `pre-push`   | Blocks direct pushes to main/master  |

## Database Scripts

Local D1 migrations run through the worker package via the root scripts
(`pnpm db:migrate:local`, `pnpm db:check`); see `docs/setup-local.md` §4. The
former standalone Turso scripts (`bootstrap.mjs`, `db-migrate-local.mjs`) were
deleted in GOAP-292 — the app runtime is D1 and the Turso service is not used.

## Utility Scripts

| Script                  | Purpose                                 |
| ----------------------- | --------------------------------------- |
| `install-hooks.sh`      | Copy hooks to `.git/hooks/` with dedup  |
| `validate-git-hooks.sh` | Check for global hooks overriding local |
| `validate-shas.sh`      | Detect placeholder SHAs in workflows    |

## Shared Libraries

Located in `scripts/lib/`:

| File            | Purpose                                 |
| --------------- | --------------------------------------- |
| `colors.sh`     | TTY-aware ANSI color definitions        |
| `logging.sh`    | Unified log/error/success/warn helpers  |
| `repo_root.sh`  | Portable REPO_ROOT detection            |
| `lint_cache.sh` | File-hash cache to skip unchanged lints |

## Environment Variables

| Variable                          | Default    | Description                                             |
| --------------------------------- | ---------- | ------------------------------------------------------- |
| `FORCE_COLOR`                     | auto (TTY) | Force color output (`0` to disable)                     |
| `ATOMIC_COMMIT_TIMEOUT`           | `1800`     | CI check timeout in seconds                             |
| `ATOMIC_COMMIT_BASE_BRANCH`       | `main`     | Target branch for PRs                                   |
| `MAX_SKILL_LINES`                 | `250`      | Max lines per SKILL.md                                  |
| `IMPECCABLE_REQUIRED`             | `0`        | Promote impeccable findings to required (ADR-111)       |
| `SKIP_LINT`                       | `false`    | Skip the lint phase (gate exits 3)                      |
| `SKIP_TYPECHECK`                  | `false`    | Skip the typecheck phase (gate exits 3)                 |
| `SKIP_TESTS`                      | `false`    | Skip unit tests + smoke (gate exits 3)                  |
| `SKIP_SMOKE`                      | `false`    | Skip only the E2E smoke phase (gate exits 3)            |
| `SKIP_BUILD`                      | `false`    | Skip the build phase (gate exits 3)                     |
| `SKIP_DESIGN`                     | `0`        | Skip impeccable step in the quality gate (gate exits 3) |
| `QUALITY_GATE_NO_SMOKE`           | `0`        | CI-only smoke skip that does **not** trigger exit 3     |
| `BUNDLE_BUDGET_FAIL_ON_VIOLATION` | `0`        | Exit 1 when `check-bundle-budget.mjs` finds a violation |
| `BUNDLE_BUDGET_REPORT`            | unset      | Path to write markdown bundle-budget report             |

`scripts/check-harness-version.mjs` requires `do-harness version --format
json` to report `name: "do-harness"` and the exact `.do-harness-version` pin.
It is the gate's first blocking phase, so a wrong binary identity or version
fails before compliance/DORA drift can be reported.

## No Escape Hatches

This project enforces **zero bypass** of quality gates:

- **No `--no-verify`** — the pre-commit hook always runs the gate
- **No `--skip-ci`** — CI verification always enforced
- **No `ATOMIC_COMMIT_SKIP_QUALITY_GATE`** — quality gate cannot be skipped
- **No `--no-rollback`** — rollback always executes on failure
- **No `SKIP_GLOBAL_HOOKS_CHECK`** — git hooks config always validated

`SKIP_*` variables exist only for local iteration: they make
`quality_gate.sh` exit 3 ("passed with skipped phases"), which
`atomic-commit` treats as failure. CI never sets them.

If a check fails, fix the root cause. Do not silence it.
