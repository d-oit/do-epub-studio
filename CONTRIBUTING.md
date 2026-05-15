# Contributing

## PR Workflow

1. Fetch and merge latest `main`: `git fetch origin main && git merge origin/main`
2. Create a feature branch: `git checkout -b feat/my-change`
3. Make changes, write tests, run quality gate: `./scripts/quality_gate.sh`
4. Commit using the atomic commit script: `./scripts/atomic-commit/run.sh --message "type(scope): description"`
5. Push and open a PR against `main`. Use the PR template from `.github/`.

## Commit Convention

Format: `type(scope): description` (max 72 chars)

Types: `feat`, `fix`, `chore`, `docs`, `perf`, `ci`, `refactor`, `test`, `style`, `plans`

Scopes: `web`, `worker`, `reader-core`, `shared`, `schema`, `testkit`, `ui`, `infra`, `ci`, `security`, `ux`, `a11y`, `deps`

Examples:
- `feat(reader-core): add fuzzy text reanchoring fallback`
- `fix(ui): resolve Input focus ring conflict`
- `ci(quality): add coverage thresholds to verify script`

## Coding Standards

- TypeScript 6 strict mode. No `any` unless justified and isolated.
- Max 500 LOC per source file.
- Zod for boundary validation, Zustand for state, Tailwind for styling.
- Vitest + Playwright with `pool: 'forks'` for test isolation.
- i18n strings in `src/i18n/`, no hardcoded user-facing text.

## Before Committing

Run the full quality gate:

```bash
./scripts/quality_gate.sh
```

This runs lint, typecheck, test with coverage, build, and e2e smoke tests. Fix all failures before committing.

Coverage thresholds are enforced:
- web: 40% lines, 30% functions
- worker: 55% lines, 50% functions
- shared: 25% lines, 5% functions
- reader-core: 75% lines, 70% functions

## Running Tests

```bash
pnpm test:unit              # All unit tests
pnpm test:coverage          # Unit tests with coverage
pnpm test:e2e               # Full Playwright e2e
pnpm test:e2e:smoke         # Smoke tests only (@smoke tag)
pnpm bench                  # Reader-core benchmarks
```
