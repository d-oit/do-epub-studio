# Cloudflare Setup Guide

This project uses **Cloudflare Pages** for the web app and **Cloudflare Workers**
for the API backend.

## Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) v4+
- Cloudflare account with Pages and Workers enabled
- Node.js 20+ and pnpm

## Project Structure

```
do-epub-studio/
├── apps/web/          # Vite SPA → Cloudflare Pages
├── apps/worker/       # Hono API → Cloudflare Worker
├── wrangler.toml      # Worker configuration
└── .dev.vars          # Local secrets (gitignored)
```

## Local Development

### Worker (API)

```bash
# Start the Worker dev server on port 8787
cd apps/worker
pnpm dev
```

Create `.dev.vars` in the project root for local secrets:

```env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
SESSION_SECRET=local-dev-secret-min-32-chars
```

### Web App

```bash
# Start the Vite dev server on port 5173
cd apps/web
pnpm dev
```

The web app proxies API requests to the Worker dev server.

## Deployment

### Cloudflare Pages (Web App)

Deployment is automated via GitHub Actions:

1. **Preview deploys** — every PR gets a preview URL
2. **Production deploys** — merging to `main` deploys to production

The `lighthouse.yml` workflow deploys a preview and runs Lighthouse audits
against catalog, admin, auth, and reader routes.

Manual deploy:

```bash
pnpm build
npx wrangler pages deploy apps/web/dist --project-name=do-epub-studio
```

### Cloudflare Worker (API)

The Worker deploys via `release.yml` on tagged releases.

Manual deploy:

```bash
cd apps/worker
pnpm deploy
```

## Configuration

### wrangler.toml

Key settings:

- `name` — Worker name
- `main` — Entry point (`src/index.ts`)
- `compatibility_date` — Workers runtime compatibility
- `durable_objects` — Rate limiter DO bindings
- `r2_buckets` — EPUB storage bucket

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `TURSO_DATABASE_URL` | Turso database connection URL |
| `TURSO_AUTH_TOKEN` | Turso authentication token |
| `SESSION_SECRET` | Session token signing secret (min32 chars) |

### Secrets Management

- **Production** — set via `wrangler secret put <NAME>`
- **Local** — `.dev.vars` file (never committed)
- **CI** — GitHub repository secrets

## Custom Actions

The repo includes a reusable action at `.github/actions/setup-pnpm/` that
handles Node.js and pnpm installation for all CI workflows.

## References

- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- Coding guide §5 — Deployment architecture
