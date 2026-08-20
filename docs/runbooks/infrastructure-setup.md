# Infrastructure Setup Runbook

This runbook documents the steps to set up production infrastructure for
d.o.EPUB Studio. It is intended for operators with access to the
Cloudflare dashboard and relevant API keys.

**Production origins (GOAP-252):**

| Surface | Origin |
|---|---|
| Frontend (Render static SPA) | `https://do-epub-studio.onrender.com` |
| Worker API | `https://api.do-epub-studio.workers.dev` (after `wrangler deploy`) |

The web build must target the Worker via `VITE_API_BASE_URL` at build time;
the Worker must allow the frontend origin via `APP_BASE_URL` (CORS,
recovery links, signed file URLs) and WebAuthn settings. Setting the wrong
origin here breaks login, recovery emails, and passkeys even after a
successful deploy.

---

## Prerequisites

- Cloudflare account with access to the d.o.EPUB Studio zone
- `wrangler` CLI installed and authenticated (`wrangler login`)
- Node.js 20+ and pnpm

---

## 1. Cloudflare Email Sending Binding

### Dashboard Setup

1. Go to Cloudflare Dashboard → your zone → **Email** → **Email Routing**
2. Set up Email Routing if not already configured (DNS records are
   auto-added)
3. Under **Sending**, set up a sending domain (verify domain via DNS TXT
   record)
4. Go to your Worker → **Settings** → **Bindings** → **Add Binding**
5. Select **Email Sending** as the binding type
6. Set the binding variable name to: `EMAIL_SEND`
7. Set the sender email address (e.g., `noreply@do-epub-studio.example.com`)

### Configuration

The `EMAIL_SENDER` variable should be set in `wrangler.jsonc` `vars` (or as
a Worker secret):

```json
"vars": {
  "EMAIL_SENDER": "noreply@do-epub-studio.example.com"
}
```

### Verification

Run the health check or manually test via:

```bash
curl -X POST https://api.do-epub-studio.workers.dev/api/admin/recovery-request \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

If the binding is configured, the email should arrive. If it falls back
to `LoggingEmailTransport`, check `wrangler tail` for the warning log.

---

## 2. D1 Database (runtime DB)

The Worker's runtime database is **D1** (`env.DB`, see
`apps/worker/src/db/client.ts`). The 12 migrations live in
`packages/schema/migrations/` and are wired via `migrations_dir` in
`apps/worker/wrangler.jsonc` — `wrangler d1 migrations apply` and
`wrangler deploy` pick them up automatically.

### Provisioning

```bash
# Create the production database
pnpm exec wrangler d1 create do-epub-studio
# → note the returned database_id and paste it into wrangler.jsonc's
#   d1_databases[0].database_id (replace the placeholder)

# Apply all migrations
pnpm exec wrangler d1 migrations apply do-epub-studio --remote
```

### Verification

```bash
pnpm exec wrangler d1 execute do-epub-studio --remote --command="SELECT COUNT(*) FROM books"
pnpm exec wrangler d1 migrations list do-epub-studio
```

> **Note:** Turso (`TURSO_DATABASE_URL` / `@libsql/client`) is only used by
> the standalone demo-account seed script and the demo-login fail-closed
> detection — it is NOT the Worker's runtime DB. Production demo login is
> disabled regardless (fail-closed, ADR-233/244).

---

## 3. R2 Bucket

### Creation

```bash
pnpm exec wrangler r2 bucket create do-epub-studio-books
```

The bucket is already bound in `wrangler.jsonc` as `BOOKS_BUCKET`.

---

## 4. KV Namespace

### Creation

```bash
pnpm exec wrangler kv namespace create CACHE_KV
# → note the returned id and paste it into wrangler.jsonc's
#   kv_namespaces[0].id (replace the placeholder-cache-kv-id)
```

---

## 5. Worker Secrets

Set all required secrets (from `apps/worker`):

```bash
# Session signing secret (used for signed URLs and token HMAC)
echo "SESSION_SIGNING_SECRET=<random-hex-64>" | pnpm exec wrangler secret put SESSION_SIGNING_SECRET

# Invite token secret (used for magic-link JWT signing)
echo "INVITE_TOKEN_SECRET=<random-hex-64>" | pnpm exec wrangler secret put INVITE_TOKEN_SECRET

# Application base URL = the FRONTEND origin (CORS allowlist, recovery
# links, signed file URLs). NOT the worker URL.
echo "APP_BASE_URL=https://do-epub-studio.onrender.com" | pnpm exec wrangler secret put APP_BASE_URL

# Environment flag
echo "ENVIRONMENT=production" | pnpm exec wrangler secret put ENVIRONMENT

# WebAuthn must match the frontend origin or admin passkey login breaks.
echo "WEBAUTHN_RP_ID=do-epub-studio.onrender.com" | pnpm exec wrangler secret put WEBAUTHN_RP_ID
echo "WEBAUTHN_ORIGIN=https://do-epub-studio.onrender.com" | pnpm exec wrangler secret put WEBAUTHN_ORIGIN

# Demo login stays OFF in production (fail-closed). Leave unset.
```

### Secret Generation Helper

To generate cryptographically strong secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. Durable Objects

### Migration

Durable Objects require a migration step during first deploy:

```bash
pnpm exec wrangler deploy --latest-migration
```

This registers the `RateLimiterDO` class and provisions the Durable Object
namespace.

---

## 7. Frontend build (`VITE_API_BASE_URL`)

The web app only calls same-origin `/api/*` in production when
`VITE_API_BASE_URL` is baked in at build time (see
`apps/web/src/lib/api/core.ts`). On the Render service:

1. Set env var `VITE_API_BASE_URL=https://api.do-epub-studio.workers.dev`
2. Rebuild/redeploy (Vite inlines env vars at build time)
3. Verify the deployed bundle contains the worker origin:
   `grep -o 'api.do-epub-studio.workers.dev' <bundle.js>`

---

## 8. Deploy

```bash
cd apps/worker
pnpm exec wrangler deploy --config wrangler.jsonc
# First deploy: pnpm exec wrangler deploy --latest-migration
```

Verify the API is live:

```bash
curl -s https://api.do-epub-studio.workers.dev/api/health
# → {"ok":true,"service":"do-epub-studio-worker"}
```

> The release workflow (`.github/workflows/release.yml`) also deploys the
> Worker on every `v*` tag once `CLOUDFLARE_API_TOKEN` +
> `CLOUDFLARE_ACCOUNT_ID` secrets exist, and its post-deploy health check
> asserts the `/api/health` JSON contract (fail-closed, GOAP-252).

---

## 9. Verification Checklist

After all infrastructure is configured, run through this checklist:

### Email
- [ ] `createEmailTransport(env)` returns `SendEmailTransport`
  (check: `env.EMAIL_SEND` is defined)
- [ ] Recovery-request flow sends actual email
- [ ] Email arrives with correct sender, subject, and content

### Database
- [ ] `wrangler d1 execute do-epub-studio --remote --command="SELECT COUNT(*) FROM books"`
  returns successfully
- [ ] All 12 migrations applied (`wrangler d1 migrations list do-epub-studio`)
- [ ] Admin login works (validates Argon2id password hash)

### R2
- [ ] `wrangler r2 object list do-epub-studio-books` shows EPUB files
- [ ] Signed URL flow works: request → signed URL → file stream

### Durable Objects
- [ ] Rate limiter counters work: rapid requests to a single route
  return 429 after the limit
- [ ] `wrangler tail` shows rate limiter logs

### Health & API contract (GOAP-252)
- [ ] `GET /api/health` returns `200` + `{"ok":true,"service":"do-epub-studio-worker"}`
- [ ] `GET /api/catalog?limit=1` returns JSON, NOT HTML
  (`curl -sI ... | grep -i content-type` shows `application/json`)
- [ ] Login submit from the Render frontend returns a session, not
  "Invalid server response" (CORS + `VITE_API_BASE_URL` correct)

### Security Headers
- [ ] All responses include CSP, HSTS, and X-Content-Type-Options headers
- [ ] CSP does not contain `unsafe-inline` for scripts
- [ ] traceId is present in all error responses

### Telemetry
- [ ] `POST /api/telemetry` returns 202
- [ ] Telemetry events are persisted to `telemetry_events` table
- [ ] Admin audit view shows telemetry entries

---

## Appendix: Useful Commands

```bash
# View real-time logs
pnpm exec wrangler tail

# Run a SQL query against D1
pnpm exec wrangler d1 execute do-epub-studio --remote --command="SELECT * FROM audit_log LIMIT 10"

# List all R2 objects
pnpm exec wrangler r2 object list do-epub-studio-books

# Deploy with migrations
pnpm exec wrangler deploy --latest-migration

# Rollback to previous version
pnpm exec wrangler rollback
```
