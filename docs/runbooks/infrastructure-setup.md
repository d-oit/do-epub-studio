# Infrastructure Setup Runbook

This runbook documents the steps to set up production infrastructure for
d.o.EPUB Studio. It is intended for operators with access to the
Cloudflare dashboard and relevant API keys.

---

## Prerequisites

- Cloudflare account with access to the d.o.EPUB Studio zone
- `wrangler` CLI installed and authenticated (`wrangler login`)
- `turso` CLI installed and authenticated
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

The `EMAIL_SENDER` variable should be set in `wrangler.jsonc` `vars`:

```json
"vars": {
  "APP_BASE_URL": "https://do-epub-studio.example.com",
  "EMAIL_SENDER": "noreply@do-epub-studio.example.com"
}
```

### Verification

Run the health check or manually test via:

```bash
curl -X POST https://do-epub-studio.example.com/api/admin/recovery-request \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

If the binding is configured, the email should arrive. If it falls back
to `LoggingEmailTransport`, check `wrangler tail` for the warning log.

---

## 2. Turso Database

### Provisioning

```bash
# Install turso CLI
curl -sSfL https://get.turso.io | bash

# Login
turso auth login

# Create the database
turso db create do-epub-studio

# Get the database URL
turso db show do-epub-studio --url
# Output: libsql://do-epub-studio-<org>.turso.io
```

### Secrets

Set these Worker secrets (from project root):

```bash
echo "TURSO_DATABASE_URL=libsql://do-epub-studio-<org>.turso.io" | wrangler secret put TURSO_DATABASE_URL
echo "TURSO_AUTH_TOKEN=$(turso db tokens create do-epub-studio)" | wrangler secret put TURSO_AUTH_TOKEN
```

### Migrations

```bash
# Run migrations (this is automated in CI, but can be done manually)
wrangler d1 migrations apply do-epub-studio
```

---

## 3. R2 Bucket

### Creation

```bash
# Create the bucket
wrangler r2 bucket create do-epub-studio-books
```

The bucket is already bound in `wrangler.jsonc` as `BOOKS_BUCKET`.

---

## 4. Worker Secrets

Set all required secrets (from project root):

```bash
# Session signing secret (used for signed URLs and token HMAC)
echo "SESSION_SIGNING_SECRET=$(wrangler secret generate SESSION_SIGNING_SECRET)"

# Invite token secret (used for magic-link JWT signing)
echo "INVITE_TOKEN_SECRET=$(wrangler secret generate INVITE_TOKEN_SECRET)"

# Application base URL
echo "APP_BASE_URL=https://do-epub-studio.example.com" | wrangler secret put APP_BASE_URL
```

### Secret Generation Helper

To generate cryptographically strong secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 5. Durable Objects

### Migration

Durable Objects require a migration step during first deploy:

```bash
wrangler deploy --latest-migration
```

This registers the `RateLimiterDO` class and provisions the Durable Object
namespace.

---

## 6. DNS and Domain

### Configuration

1. Go to Cloudflare Dashboard → your zone → **DNS**
2. Add an **A** record (proxied) pointing to `192.0.2.1` (placeholder —
   Cloudflare Workers use `@` CNAME for root domain)
3. Or add a **CNAME** record for a subdomain:
   - Name: `read` (or your subdomain)
   - Target: `<your-worker>.<your-subdomain>.workers.dev`
   - Proxy status: Proxied

Alternatively, configure a custom domain in Workerd:

```bash
wrangler deploy --routes https://read.do-epub-studio.example.com/*
```

### Workers.dev Domain

Every Worker gets a `<worker>.<subdomain>.workers.dev` URL by default.
Use this for testing before adding a custom domain.

---

## 7. Verification Checklist

After all infrastructure is configured, run through this checklist:

### Email
- [ ] `createEmailTransport(env)` returns `SendEmailTransport`
  (check: `env.EMAIL_SEND` is defined)
- [ ] Recovery-request flow sends actual email
- [ ] Email arrives with correct sender, subject, and content

### Database
- [ ] `wrangler d1 execute do-epub-studio --command="SELECT COUNT(*) FROM books"`
  returns successfully
- [ ] All 8+ migrations applied (`wrangler d1 migrations list do-epub-studio`)
- [ ] Admin login works (validates Argon2id password hash)

### R2
- [ ] `wrangler r2 object list do-epub-studio-books` shows EPUB files
- [ ] Signed URL flow works: request → signed URL → file stream

### Durable Objects
- [ ] Rate limiter counters work: rapid requests to a single route
  return 429 after the limit
- [ ] `wrangler tail` shows rate limiter logs

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
wrangler tail

# Run a SQL query against Turso
wrangler d1 execute do-epub-studio --command="SELECT * FROM audit_log LIMIT 10"

# List all R2 objects
wrangler r2 object list do-epub-studio-books

# Deploy with migrations
wrangler deploy --latest-migration

# Rollback to previous version
wrangler rollback
```
