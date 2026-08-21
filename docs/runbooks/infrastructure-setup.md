# Infrastructure Setup Runbook

This runbook documents the steps to set up production infrastructure for
d.o.EPUB Studio. It is intended for operators with access to the
Cloudflare dashboard.

## Deployment model (GOAP-252)

The app is served entirely by **Cloudflare Pages** — the build runs on
Cloudflare directly (Pages Git integration, see root `wrangler.toml`):

| Surface | How it's served |
|---|---|
| Frontend (SPA) | Pages Git integration builds `apps/web/dist` |
| API (`/api/*`) | Pages Functions (`functions/api/[[path]].ts`) re-serves the existing Worker's Hono app on the **same origin** |

Because the API shares the frontend's origin, production needs **no separate
Worker deployment, no `VITE_API_BASE_URL`, and no CORS** — the web app's
production default (`window.location.origin`) already targets same-origin
`/api/*`.

Cloudflare resources (D1, R2, KV) are bound to the Pages project via the
dashboard. The Worker's `wrangler.jsonc` is still used for **local dev**
(`wrangler dev`) and tests only.

---

## Prerequisites

- Cloudflare account with access to the d.o.EPUB Studio zone
- `wrangler` CLI installed and authenticated (`wrangler login`) — only needed
  for local dev and one-time resource provisioning
- Node.js 20+ and pnpm

---

## 1. Cloudflare Email Sending Binding

> Email Sending is **not** a supported Pages Function binding. Recovery email
> falls back to `LoggingEmailTransport` (logged, not delivered) — login is
> unaffected. If email delivery is required later, deploy the Worker
> standalone (see `apps/worker/wrangler.jsonc`) and point the frontend at it
> via `VITE_API_BASE_URL`.

---

## 2. D1 Database (runtime DB)

The API's runtime database is **D1** (`env.DB`, see
`apps/worker/src/db/client.ts`). The 12 migrations live in
`packages/schema/migrations/` (wired via `migrations_dir` in
`apps/worker/wrangler.jsonc` for local use).

### Provisioning

```bash
# Create the production database
pnpm exec wrangler d1 create do-epub-studio
# → note the returned database_id

# Apply all migrations
pnpm exec wrangler d1 migrations apply do-epub-studio --remote
```

### Bind to the Pages project

In the Cloudflare dashboard → your Pages project → **Settings → Bindings →
Add → D1 database**:
- Variable name: `DB`
- D1 database: `do-epub-studio`

Redeploy the project for the binding to take effect.

### Verification

```bash
pnpm exec wrangler d1 execute do-epub-studio --remote --command="SELECT COUNT(*) FROM books"
pnpm exec wrangler d1 migrations list do-epub-studio
```

> **Note:** Turso (`TURSO_DATABASE_URL` / `@libsql/client`) is only used by
> the standalone demo-account seed script and the demo-login fail-closed
> detection — it is NOT the API's runtime DB. Production demo login is
> disabled regardless (fail-closed, ADR-233/244).

---

## 3. R2 Bucket

### Creation

```bash
pnpm exec wrangler r2 bucket create do-epub-studio-books
```

### Bind to the Pages project

Dashboard → Pages project → **Settings → Bindings → Add → R2 bucket**:
- Variable name: `BOOKS_BUCKET`
- R2 bucket: `do-epub-studio-books`

---

## 4. KV Namespace

### Creation

```bash
pnpm exec wrangler kv namespace create CACHE_KV
# → note the returned id
```

### Bind to the Pages project

Dashboard → Pages project → **Settings → Bindings → Add → KV namespace**:
- Variable name: `CACHE_KV`
- KV namespace: the created namespace

---

## 5. Environment Variables & Secrets (Pages dashboard)

Set on the Pages project (Settings → Environment variables; use secrets for
sensitive values):

```text
SESSION_SIGNING_SECRET   # random hex (signed URLs + token HMAC)
INVITE_TOKEN_SECRET      # random hex (magic-link JWT signing)
APP_BASE_URL             # https://do-epub-studio.pages.dev (frontend origin)
ENVIRONMENT              # production
WEBAUTHN_RP_ID           # do-epub-studio.pages.dev
WEBAUTHN_ORIGIN          # https://do-epub-studio.pages.dev
DEMO_LOGIN_ENABLED       # leave unset (fail-closed in production)
```

Secret generation:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> The `RATE_LIMITER` Durable Object cannot be created inside a Pages project,
> so rate limiting fails open (documented in
> `apps/worker/src/lib/rate-limit-client.ts`) — acceptable; the API still
> works without it.

---

## 6. Deploy

Nothing to deploy manually — pushing to the production branch triggers the
Cloudflare Pages build (frontend + `functions/`). To preview locally:

```bash
pnpm --filter @do-epub-studio/web build
pnpm exec wrangler pages dev apps/web/dist --compatibility-date=2026-05-30
```

Verify the API is live (same origin as the site):

```bash
curl -s https://do-epub-studio.pages.dev/api/health
# → {"ok":true,"service":"do-epub-studio-worker"}
```

> The release workflow (`.github/workflows/release.yml`) runs a fail-closed
> post-deploy health check against `https://do-epub-studio.pages.dev/api/health`
> (asserts `200` + `{"ok":true}`).

---

## 7. Verification Checklist

After all infrastructure is configured, run through this checklist:

### Database
- [ ] `wrangler d1 execute do-epub-studio --remote --command="SELECT COUNT(*) FROM books"` returns successfully
- [ ] All 12 migrations applied (`wrangler d1 migrations list do-epub-studio`)
- [ ] Admin login works (validates Argon2id password hash)

### R2
- [ ] `wrangler r2 object list do-epub-studio-books` shows EPUB files
- [ ] Signed URL flow works: request → signed URL → file stream

### Health & API contract (GOAP-252)
- [ ] `GET https://do-epub-studio.pages.dev/api/health` returns `200` + `{"ok":true}`
- [ ] `GET https://do-epub-studio.pages.dev/api/catalog?limit=1` returns JSON, NOT HTML
- [ ] Login submit from the site returns a session, not "Invalid server response"
- [ ] A static path (e.g. `/robots.txt`) still serves the asset, not the API

### Security Headers
- [ ] All API responses include CSP, HSTS, and X-Content-Type-Options headers
- [ ] CSP does not contain `unsafe-inline` for scripts
- [ ] traceId is present in all error responses

### Telemetry
- [ ] `POST /api/telemetry` returns 202
- [ ] Telemetry events are persisted to `telemetry_events` table
- [ ] Admin audit view shows telemetry entries

---

## Appendix: Useful Commands

```bash
# View real-time logs (local dev)
pnpm exec wrangler tail

# Run a SQL query against D1 (remote)
pnpm exec wrangler d1 execute do-epub-studio --remote --command="SELECT * FROM audit_log LIMIT 10"

# List all R2 objects
pnpm exec wrangler r2 object list do-epub-studio-books

# Apply D1 migrations
pnpm exec wrangler d1 migrations apply do-epub-studio --remote
```
