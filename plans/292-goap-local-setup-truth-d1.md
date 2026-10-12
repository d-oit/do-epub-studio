# GOAP-292: local setup truth — D1 commands, Turso-service removal, doc alignment (F4)

**Status:** DONE (implemented + verified 2026-09-30)
**Date:** 2026-09-30
**Source:** `analysis/feature-docs-harness-audit.md` F4 (GOAP-290)
**Governance:** ADR-214 (evidence beats aspiration), ADR-278-era command truth
(scripts the docs name must exist and work), runbook `docs/runbooks/infrastructure-setup.md`
(prod D1 path)

## Decision

The API runtime is D1 (`env.DB`); the Turso **service** is not used anywhere.
The demo-account seed's libsql client is pointed at the **local D1 sqlite file**
(verified recipe in `plans/256-goap-demo-login-e2e-vertical.md` §Steps), and the
`TURSO_DATABASE_URL` variable name survives only as that seed pointer plus the
demo-login production guard. Therefore:

- `db:migrate:local` / `db:check` become working Wrangler D1 commands run from
  the worker package cwd (same local state `wrangler dev` uses).
- `db:migrate:prod` is removed — it never worked (`MODULE_NOT_FOUND`) and the
  operator path is the runbook's explicit remote command.
- Turso-service tooling (`scripts/db-migrate-local.mjs`, `scripts/bootstrap.mjs`,
  `docs/setup-turso.md`) is deleted as obsolete; the seed recipe moves into
  `docs/setup-local.md`.

## Items

| #   | Change                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `package.json`: `db:migrate:local` → `wrangler d1 migrations apply do-epub-studio --local` via `--filter @do-epub-studio/worker`; `db:check` → `wrangler d1 migrations list … --local`; drop `db:migrate:prod` |
| 2   | Delete `scripts/db-migrate-local.mjs`, `scripts/bootstrap.mjs`, `docs/setup-turso.md`; update `scripts/README.md`                                                                                              |
| 3   | `README.md` + `docs/setup-local.md`: D1 stack line, prerequisites, env table, D1 migration section, demo-seed recipe, troubleshooting; `apps/worker/.dev.vars.example` annotations                             |
| 4   | `docs/architecture.md` (×4), `docs/ONBOARDING.md`, `docs/coding-guide.md` (×4), `docs/setup-cloudflare.md`, `docs/conventions.md`, `packages/schema/README.md` truth fixes                                     |
| 5   | `docs/runbooks/infrastructure-setup.md`: command shapes fixed to worker cwd; Turso note corrected (libsql client → local D1 file)                                                                              |
| 6   | `scripts/seed-demo-accounts.mjs` header: local recipe pointer                                                                                                                                                  |

## Acceptance (from the audit, F4)

- A fresh clone following the documented quick start performs a real local D1
  migration; `db:check`/`db:migrate:prod` either operate or are removed with
  their documentation.
- No live doc or script instructs a Turso-service step for the app database.

## Verification

- Fresh-state apply: `pnpm --filter @do-epub-studio/worker exec wrangler d1
migrations apply do-epub-studio --local --persist-to <empty dir>` → 18
  migrations applied; list shows all applied.
- `pnpm db:migrate:local` + `pnpm db:check` against the real local state: exit 0,
  same state the dev server reads (worker cwd).
- `wrangler dev` smoke against the migrated local state (health route), if dev
  secrets are present.
- Repo sweep: no remaining live references to the deleted files/commands;
  prettier clean on every changed file.

## Non-actions

- Worker `TURSO_DATABASE_URL` env type + `demo.ts` production guard unchanged
  (security-relevant naming, not a local-setup defect).
- Demo-seed transport unchanged (libsql client); moving it to a native D1
  transport is a separate decision, as is any remote/live demo seeding.
- No remote migration, deploy, or D1 mutation beyond the local emulation.

## Observed results (2026-09-30)

- Fresh-state apply: `wrangler d1 migrations apply do-epub-studio --local
--persist-to <empty dir>` applied **all 18 migrations**; the following
  `migrations list` reported none pending. The documented root command
  (`pnpm db:migrate:local`) delegates to the identical invocation and returned
  "No migrations to apply" against the real local state (exit 0), as did
  `pnpm db:check`.
- Dev-server smoke (managed service, real `wrangler dev`): booted with
  `env.DB (do-epub-studio) D1 Database local`; `GET /api/health` → 200;
  `POST /api/demo/reader-login` → 200 with a live session and the demo book,
  proving D1 reads/writes against the state these commands manage;
  `GET /api/catalog` → 200.
- Sweep: no live document or script references `setup-turso.md`,
  `db-migrate-local.mjs`, `bootstrap.mjs`, or `db:migrate:prod`; remaining
  `Turso`/`TURSO_DATABASE_URL` mentions are the intentional ones (seed script,
  `.dev.vars.example` annotation, runbook note, scripts README historical
  note, seed tests).
- Prettier clean on every changed file (`.dev.vars.example` has no inferred
  parser and is skipped by repo-wide runs).
