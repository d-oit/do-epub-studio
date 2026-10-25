# Deploy and provision the demo preview

Use a disposable Cloudflare Pages **preview**, with its own D1 database and R2
bucket. Production always rejects demo login, including the public demo
passwords used through the ordinary sign-in forms. An allowlist does not
override `ENVIRONMENT=production` (ADR-1014).

## Provision the resources

From the repository root, authenticate Wrangler using your normal Cloudflare
credentials and create resources if they do not already exist:

```bash
pnpm exec wrangler d1 create do-epub-studio-preview
pnpm exec wrangler r2 bucket create do-epub-studio-books-preview
```

Record the actual preview database ID under `env.preview.d1_databases` in
`wrangler.toml`. Its ID and name must differ from the production `DB`. The
preview `BOOKS_BUCKET` must also differ from production. The provisioning
command refuses shared or missing bindings before it applies migrations.

Configure separate preview `SESSION_SIGNING_SECRET` and `INVITE_TOKEN_SECRET`
secrets in the Pages dashboard. Keep server secrets out of `VITE_*` variables.
The checked-in preview configuration supplies `ENVIRONMENT=preview`,
`DEMO_LOGIN_ENABLED=1` and `DEMO_ACCOUNTS_PROD_ALLOWLIST=demo-preview`.

## Seed accounts and a readable EPUB

Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` through your normal secret
manager. The token needs access to the preview D1 database and R2 bucket.
Run this explicit operator command; it is never a production deployment hook:

```bash
node scripts/seed-demo-preview.mjs --remote
```

It applies pending D1 migrations, seeds the reserved reader and disabled
administrator, generates a two-chapter EPUB, uploads it to preview R2 and
records the `book_files` metadata. Existing non-demo accounts and books with
the requested slug cause refusal. Repeating the command revokes prior demo
sessions and reuses the sample content identity.

To demonstrate administrator features on this disposable preview, explicitly
enable that account:

```bash
node scripts/seed-demo-preview.mjs --remote --enable-admin
```

The default remains disabled outside local development. The administrator can
modify this preview's data; do not point it at real user content. Rerunning
without `--enable-admin` disables the account again.

Public demo credentials are `demo.reader@example.local` /
`demo-reader-password` and `demo.admin@example.local` / `demo-admin-password`.
Optional `DEMO_READER_PASSWORD` and `DEMO_ADMIN_PASSWORD` environment overrides
must match the corresponding frontend `VITE_DEMO_*_PASSWORD` build inputs if
credential autofill is used. Passwords are stored only as Argon2id hashes.

## Build and deploy the preview

```bash
VITE_DEMO_LOGIN_ENABLED=1 pnpm build
pnpm exec wrangler pages deploy apps/web/dist --project-name=do-epub-studio --branch=demo-preview
```

Use a preview branch, never the Pages project's production branch. The
Lighthouse PR workflow also enables demo UI for its preview builds. The
frontend flag shows the admin controls; it cannot enable an account or bypass
the server policy. Rebuild after changing frontend flags.

The repository-root `functions/` entry makes `/api/*` available when Wrangler
runs from the root. Pages preview requests derive signed-file links and
WebAuthn origins from their own deployment URL, so they never fetch sample
content from the production site.

## Verify the deployed demo

Run against the preview URL printed by Wrangler, using the default demo slug
and credentials, after explicit administrator enablement:

```bash
E2E_DEMO_PREVIEW_URL=https://<preview>.do-epub-studio.pages.dev \
  pnpm exec playwright test --project=demo-preview
```

This dedicated lane calls the real API. It checks the reader demo button,
autofill followed by ordinary credential sign-in, actual chapter text from the
R2 EPUB, same-origin file retrieval and admin entry. It starts no local web
server and is excluded from the mocked test projects.

For a disposable local provisioning check:

```bash
node scripts/seed-demo-preview.mjs --local --persist-to /tmp/epub-demo-preview --enable-admin
```

That command uses Wrangler's local D1/R2 emulation and needs no Cloudflare
credentials. Serve a local Pages preview with the same state and preview
bindings when running the browser lane locally. A successful account seed,
health response or reader toolbar alone is insufficient evidence of readable
book content.

## Diagnose failures

- `403 DEMO_DISABLED`: verify preview runtime flags, marked demo users, account
  state, demo book and live grant. Production refusal is expected.
- Admin button absent: rebuild with `VITE_DEMO_LOGIN_ENABLED=1`.
- Admin login denied after seed: use `--enable-admin` only for the disposable
  preview. Existing MFA enrollment still requires the normal MFA login flow.
- EPUB file missing: verify preview R2 binding and run the full preview
  provisioning command. The legacy account-only seed creates a placeholder.
- `429 TOO_MANY_REQUESTS`: wait for the demo login window to reset. Pages uses
  the D1 fallback when a rate-limiter Durable Object is not bound.

Cloudflare references: [Pages configuration and preview overrides](https://developers.cloudflare.com/pages/functions/wrangler-configuration/),
[Functions directory placement](https://developers.cloudflare.com/pages/functions/get-started/),
and [D1 parameterized REST queries](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).
