# Local Setup Guide

This guide walks you through setting up d.o.EPUB Studio for local development.

## 1. Prerequisites

- **Node.js** v22.x (LTS)
- **pnpm** >= 10 (the project uses `pnpm@10.33.0` -- configured in `package.json`)
- **Git**

Wrangler ships as a devDependency and is invoked through `pnpm` — no global
install is needed.

Install pnpm globally if you do not have it:

```bash
npm install -g pnpm@latest
```

## 2. Clone and Install

```bash
git clone <repo-url> do-epub-studio
cd do-epub-studio
pnpm install
```

This installs all dependencies for the monorepo (apps + packages) in one command.

## 3. Environment Variables

### Worker (`apps/worker/.dev.vars`)

Copy the example file and fill in the values:

```bash
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
```

Required variables in `apps/worker/.dev.vars`:

| Variable                 | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| `SESSION_SIGNING_SECRET` | Secret for signing session tokens                          |
| `INVITE_TOKEN_SECRET`    | Secret for signing invite tokens                           |
| `APP_BASE_URL`           | Base URL of the web app (default: `http://127.0.0.1:5173`) |

The worker's runtime database is D1 and needs no connection secret. The
`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` entries in `.dev.vars.example` are
only for the optional demo-account seed (see §4, "Demo accounts").

For production deployments, these values are set as Wrangler secrets (not committed to git).

### Web (`apps/web/.env.local`)

If needed, create `apps/web/.env.local` for frontend-specific overrides. The web app reads the worker URL at runtime; by default it calls the local Wrangler dev server.

## 4. Database Setup (D1)

The worker's runtime database is Cloudflare D1 (`env.DB`). Local development
uses Wrangler's local D1 emulation, and the schema migrations live in
`packages/schema/migrations/` (wired through `migrations_dir` in
`apps/worker/wrangler.jsonc`). No database server or account is needed.

Apply the migrations to the local state used by `pnpm dev`:

```bash
pnpm db:migrate:local
```

Check which migrations are applied:

```bash
pnpm db:check
```

Both commands run Wrangler from `apps/worker/`, so they operate on the same
local D1 state as `wrangler dev`; re-running is safe. Production migrations are
an operator action documented in
[`docs/runbooks/infrastructure-setup.md`](./runbooks/infrastructure-setup.md).

### Demo accounts (optional)

The demo-login sandbox seed (`scripts/seed-demo-accounts.mjs`, ADR-233) speaks
the libsql/SQLite protocol and is pointed at the local D1 sqlite file. Apply
migrations first and seed **before** starting `wrangler dev` (sqlite
contention):

```bash
TURSO_DATABASE_URL=file:apps/worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite \
DEMO_ACCOUNTS_ENABLED=1 DEMO_ADMIN_PASSWORD=... \
pnpm exec node scripts/seed-demo-accounts.mjs
```

Find `<hash>.sqlite` under
`apps/worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` after the
first `pnpm db:migrate:local` or `wrangler dev` run. The seed is idempotent and
fails closed in production-like environments.

### Spelling/grammar review (optional, LanguageTool)

Story/logic review runs fully in the browser. Spelling/grammar review needs a
deployment-local LanguageTool server (ADR-274); without one the panel honestly
reports those categories as unavailable:

```bash
scripts/dev/languagetool.sh   # starts LanguageTool on 127.0.0.1:8081
# then in apps/web/.env.local:
VITE_LANGUAGETOOL_URL=http://127.0.0.1:8081
```

## 5. R2 Bucket Setup

### Development (local emulation)

Wrangler's `dev` command emulates R2 locally. No extra setup is needed for local development. The bucket binding is defined in `apps/worker/wrangler.jsonc`:

```jsonc
"r2_buckets": [
  {
    "binding": "BOOKS_BUCKET",
    "bucket_name": "do-epub-studio-books"
  }
]
```

### Production (Cloudflare R2)

1. Create an R2 bucket in your Cloudflare dashboard:

   ```bash
   wrangler r2 bucket create do-epub-studio-books
   ```

2. Ensure the bucket name matches `wrangler.jsonc`.

## 6. Run the Development Server

Start both the worker and web app concurrently:

```bash
pnpm dev
```

This runs `turbo run dev --parallel`, which starts:

- **Worker** on `http://127.0.0.1:8787` (Wrangler dev)
- **Web** on `http://127.0.0.1:5173` (Vite dev server)

You can also start them individually:

```bash
# Worker only
pnpm --filter @do-epub-studio/worker dev

# Web only
pnpm --filter @do-epub-studio/web dev
```

## 7. Run Tests

### Unit tests (Vitest)

```bash
pnpm test
```

### End-to-end tests (Playwright)

Run E2E tests against the dev server:

```bash
pnpm test:e2e
```

Run only smoke tests (tagged `@smoke`):

```bash
pnpm test:e2e:smoke
```

Install Playwright browsers on first run:

```bash
pnpm exec playwright install --with-deps
```

### Tests for a single package

```bash
pnpm --filter @do-epub-studio/web test
pnpm --filter @do-epub-studio/worker test
```

## 8. Run the Quality Gate

The quality gate runs lint, typecheck, test, and build in sequence:

```bash
./scripts/quality_gate.sh
```

Or use the root convenience script:

```bash
pnpm verify
```

This is equivalent to:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Per `AGENTS.md`, the quality gate **must** pass before every commit. There are no escape hatches.

## 9. Troubleshooting

### `pnpm install` fails

- Ensure you are using Node.js v22.x. Check with `node --version`.
- Clear the pnpm store cache: `pnpm store prune`
- Remove `node_modules` and reinstall:

  ```bash
  rm -rf node_modules apps/*/node_modules packages/*/node_modules
  pnpm install
  ```

### Wrangler dev fails to start

- Ensure dependencies are installed: `pnpm install` (Wrangler is a
  devDependency; no global install is used).
- Check that `apps/worker/.dev.vars` exists and has valid values.
- Make sure port `8787` is not in use.

### Vite dev server fails

- Ensure port `5173` is not in use.
- Check that all workspace packages are installed: `pnpm install`

### D1 migrations fail

- Run `pnpm db:migrate:local` (it uses the worker package's Wrangler config and
  local state) and read the Wrangler error output.
- Run `pnpm db:check` to list applied/pending migrations.
- The runtime database is D1; `TURSO_DATABASE_URL` is unrelated to migrations
  and is only used by the optional demo-account seed.

### Type errors in workspace packages

- Rebuild dependent packages:

  ```bash
  pnpm build
  ```

- Some packages (e.g. `@do-epub-studio/schema`) must be built before the worker or web app can typecheck against them.

### Playwright tests fail to launch browsers

```bash
npx playwright install --with-deps
```

### Quality gate fails

- Read the output carefully -- the gate reports ALL failures, not just the first.
- Run individual checks to isolate the problem:

  ```bash
  pnpm lint        # ESLint
  pnpm typecheck   # TypeScript
  pnpm test        # Vitest
  pnpm build       # Turborepo build
  ```
