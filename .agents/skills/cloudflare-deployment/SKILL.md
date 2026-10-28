---
version: "1.0.0"
name: cloudflare-deployment
description: >
  Manage and troubleshoot Cloudflare Pages and Worker deployments. Activate for deployment
  failures, resource bindings (D1, R2, KV), fail-closed preflight validation, and Pages API log analysis.
category: workflow
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Cloudflare Deployment Skill

Use official Cloudflare documentation and the deployment's provider logs. Preserve every resource binding required by runtime code; make the deployment succeed by provisioning the declared resources, not by removing those bindings.

## Official platform contract

- [Wrangler configuration for Pages Functions](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) says that when `pages_build_output_dir` is declared, Wrangler configuration is the source of truth for the Pages build and its bindings.
- [Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/) requires bound resources to exist in the Cloudflare account and documents configuring bindings.
- [R2 bucket creation](https://developers.cloudflare.com/r2/buckets/create-buckets/) documents creating buckets through the Dashboard or Wrangler. In this account, Cloudflare API error `10042: Please enable R2 through the Cloudflare Dashboard` proves that R2 activation must happen before bucket creation.
- The [KV get-namespace API](https://developers.cloudflare.com/api/resources/kv/subresources/namespaces/methods/get/) and [R2 get-bucket API](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/methods/get/) provide per-resource checks; per-ID checks avoid false absence from a paginated list.

## Diagnose deployment failures

1. Retrieve the full provider-managed deployment logs before proposing a fix. The Cloudflare [Get deployment logs API](https://developers.cloudflare.com/api/operations/pages-deployment-get-deployment-logs/) uses:
   ```text
   GET /accounts/{account_id}/pages/projects/{project_name}/deployments/{deployment_id}/history/logs
   ```
2. Classify `latest_stage.name` before changing code:
   - `deploy` with `R2 bucket ... not found`: check the exact configured bucket and account's R2 activation state.
   - `build` with TypeScript/bundler diagnostics: fix the build input; do not mislabel it as an R2 problem.
3. This incident had nine deploy-stage failures for missing production/preview R2 buckets and one separate preview build failure. The build failure used `@intity/epub-js@0.3.103`, which lacked declarations; the workspace now pins `0.3.96` exactly because `^0.3.96` had allowed the bad resolution. See GOAP-1015 and ADR-1015 for deployment IDs and evidence.
4. Do not conclude that a GitHub Actions status alone explains a Pages failure. Cloudflare's Git integration creates its own deployments; retrieve their Cloudflare logs.

## Fail-closed resource preflight

The repository's preflight checks every production and preview D1, KV, and R2 binding against Cloudflare's resource APIs. It is invoked before the repository's Lighthouse workflow deploy and is mandatory for manual Pages deploys:

```bash
export CLOUDFLARE_ACCOUNT_ID='<account-id>'
export CLOUDFLARE_API_TOKEN='<token-with-D1-KV-R2-read-access>'
pnpm preflight:cloudflare
```

Both environment variables are required. A stored Wrangler OAuth session was rejected by these resource API calls in this environment; use an API token with the listed resource-read permissions, not login state alone. Missing credentials, API permission failures, network failures, malformed bindings, missing resources, and R2 error 10042 all fail closed. The script does not create or mutate resources. An API permission failure is not reported as a missing resource.

Cloudflare's automatic Pages Git integration does not wait for this repository's Actions job. The permanent correction for the observed deploy failures is therefore account provisioning, not reliance on this preflight alone.

## Permanent R2 resolution

Keep the required bindings in root `wrangler.toml`:

- Production `BOOKS_BUCKET` → `do-epub-studio-books`
- Preview `BOOKS_BUCKET` → `do-epub-studio-books-preview`

An account owner must activate R2 in the Dashboard at `https://dash.cloudflare.com/<account_id>/r2/overview`, then create both buckets:

```bash
pnpm exec wrangler r2 bucket create do-epub-studio-books
pnpm exec wrangler r2 bucket create do-epub-studio-books-preview
```

Run the preflight and redeploy after provisioning. Do not remove either binding: `apps/worker/src/routes/files.ts` reads EPUB bytes from `BOOKS_BUCKET`, and ADR-1014 requires isolated preview R2 so preview content cannot share production storage.

## Rationalizations

| Rationalization | Reality |
|---|---|
| "A deployment says the bucket is missing, so remove `BOOKS_BUCKET`." | That breaks EPUB file delivery and violates ADR-1014. Provision both required buckets. |
| "Every failed Cloudflare check is a resource-binding failure." | One incident failure was a `build`-stage TypeScript failure from a bad dependency resolution; inspect the stage and compiler diagnostics. |
| "A 403 always means R2 is disabled." | Only error code 10042 identifies the observed R2 activation gate. Other 403/4xx responses can mean permissions or other API failures. |
| "Wrangler configuration and dashboard bindings are interchangeable." | With `pages_build_output_dir` configured, the Wrangler file is authoritative for the Pages build. |
| "A green/failed GitHub Actions check is enough to diagnose Pages." | Provider-managed Pages deployments have their own history logs; query `/history/logs`. |

## Red Flags

- [ ] Removing or commenting out `r2_buckets` / `d1_databases` to force a passing deploy.
- [ ] Running a deployment without `pnpm preflight:cloudflare` and explicit API credentials.
- [ ] Treating missing credentials or API permission failures as a successful preflight.
- [ ] Attempting to create R2 buckets before the account owner resolves error 10042.
- [ ] Diagnosing Pages without retrieving its Cloudflare deployment history logs.
