# Static Analysis Gate Model

This documents how static analysis is scoped in this repository and which
gate is authoritative for application source. See ADR-215 Decision 2 and
the `.codacy.yml` path exclusions.

## Two complementary gates

### 1. Repo lint pipeline — authoritative for `apps/**` and `packages/**`

The authoritative gate for application and package source is the
repository's own lint pipeline:

- `pnpm lint` (run via `turbo run lint` across **all** packages),
- `pnpm typecheck` (strict TypeScript),
- the test suite (Vitest + Playwright).

The ESLint configuration uses **type-aware `@typescript-eslint` rules**
(`eslint.config.js`), which analyzer engines such as Codacy's built-in
eslint do not replicate here. Because Codacy's eslint runs without the
repo's exact plugin/type setup, pointing it at `apps/**` and
`packages/**` would produce a flood of findings that do not match the
authoritative gate (ADR-215 Decision 2 documents this deliberately).

### 2. Codacy Static Code Analysis — required, advisory for app source

Codacy is a **required PR check** on this repo, but by design it covers
what local ESLint does **not** cover:

- root-level configs (`vite.config.ts`, `vitest.config.ts`,
  `playwright.config.ts`, `eslint.config.js`),
- scripts and workflow YAML,
- the two `opengrep` exceptions that remain in scope
  (`apps/web/src/lib/api/index.ts` and `apps/web/src/lib/api/core.ts`).

`apps/**`, `worker/**`, and `packages/**` are excluded from Codacy's
engines (`.codacy.yml` `exclude_paths`) so the lint pipeline is the
single source of truth for that source. Codacy acting as an advisory
layer on config/scripts is the intended scope. This includes the
OwlWatch engine — its findings over `apps/**`/`packages/**` are
excluded the same way (added 2026-08-11 when OwlWatch began reporting
on app source against the strict "0 new issues" ruleset).

## When to expand Codacy scope

Revisit this document when a findings-triage backlog exists (ADR-181)
and the repo decides to have Codacy surface app-source findings again.
Until then, the authoritative gate remains `pnpm lint` + `pnpm typecheck` + tests.
