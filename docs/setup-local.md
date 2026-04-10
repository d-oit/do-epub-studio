# Local Setup Guide

This guide walks you through setting up EPUB Studio for local development.

## 1. Prerequisites

- **Node.js** >= 20 (LTS recommended)
- **pnpm** >= 10 (the project uses `pnpm@10.33.0` -- configured in `package.json`)
- **Git**
- **Wrangler CLI** (Cloudflare Workers dev tool)
- **Turso CLI** (for local database management)

Install pnpm globally if you do not have it:

```bash
npm install -g pnpm@latest
```

Install the Wrangler CLI globally:

```bash
npm install -g wrangler@latest
```

Install the Turso CLI:

```bash
# macOS/Linux
curl -sSfL https://get.tur.so/install.sh | bash
# Windows (PowerShell)
iex (irm https://get.tur.so/install.ps1)
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

| Variable | Description |
|---|---|
| `TURSO_DATABASE_URL` | Turso database URL (e.g. `libsql://do-epub-studio-your-org.turso.io`) |
| `TURSO_AUTH_TOKEN` | Auth token for the Turso database |
| `SESSION_SIGNING_SECRET` | Secret for signing session tokens |
| `INVITE_TOKEN_SECRET` | Secret for signing invite tokens |
| `APP_BASE_URL` | Base URL of the web app (default: `http://127.0.0.1:5173`) |

For production deployments, these values are set as Wrangler secrets (not committed to git).

### Web (`apps/web/.env.local`)

If needed, create `apps/web/.env.local` for frontend-specific overrides. The web app reads the worker URL at runtime; by default it calls the local Wrangler dev server.

## 4. Database Setup (Turso)

### Option A: Local Turso database

```bash
# Create a local Turso database (if you do not have one)
turso db create do-epub-studio-local

# Run migrations
pnpm db:migrate:local
```

### Option B: Remote Turso database

Point `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.dev.vars` to an existing Turso database.

### Verify the database connection

```bash
pnpm db:check
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

```bash
pnpm test:e2e
```

Install Playwright browsers on first run:

```bash
npx playwright install
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

To skip tests (e.g. in CI when test environment is not available):

```bash
SKIP_TESTS=true ./scripts/quality_gate.sh
```

Per `AGENTS.md`, the quality gate **must** pass before every commit.

## 9. Troubleshooting

### `pnpm install` fails

- Ensure you are using Node.js >= 20. Check with `node --version`.
- Clear the pnpm store cache: `pnpm store prune`
- Remove `node_modules` and reinstall:

  ```bash
  rm -rf node_modules apps/*/node_modules packages/*/node_modules
  pnpm install
  ```

### Wrangler dev fails to start

- Ensure `wrangler` is installed: `npm list -g wrangler`
- Check that `apps/worker/.dev.vars` exists and has valid values.
- Make sure port `8787` is not in use.

### Vite dev server fails

- Ensure port `5173` is not in use.
- Check that all workspace packages are installed: `pnpm install`

### Turso migration fails

- Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.dev.vars`.
- Run `pnpm db:check` to confirm connectivity.
- For local databases, ensure `turso` CLI is installed and the database exists.

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
