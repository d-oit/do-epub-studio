# ADR-1015: Cloudflare Resource Preflight and Binding Integrity

**Status:** Accepted

## Context

Cloudflare Pages project `do-epub-studio` had ten failed deployments across PRs and `main`. Provider history logs were fetched for all ten through the official Pages deployment log API:

- Nine `deploy`-stage failures reported either production `do-epub-studio-books` or preview `do-epub-studio-books-preview` as missing.
- One independent `build`-stage failure was a Dependabot Sentry preview. Its lockfile resolved `@intity/epub-js@0.3.103`, which lacked declarations and produced TS7016 errors plus dependent TS7006 errors.

Live Cloudflare API checks verified the configured D1 databases and KV namespace (HTTP 200). R2 returned HTTP 403/code 10042 (`Please enable R2 through the Cloudflare Dashboard`), and Wrangler could not create the missing buckets until the account owner activates R2. Therefore the nine deploy failures share an account-level resource-provisioning cause; the build failure has a separate package-version cause.

Official Cloudflare references establish the relevant contract:

1. [Wrangler configuration for Pages Functions](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) makes the Wrangler file authoritative when `pages_build_output_dir` is configured.
2. [Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/) documents binding resources and their account configuration.
3. [R2 bucket creation](https://developers.cloudflare.com/r2/buckets/create-buckets/) documents resource creation. The account's actual API response code 10042 requires Dashboard activation before create operations work.
4. The [KV get namespace API](https://developers.cloudflare.com/api/resources/kv/subresources/namespaces/methods/get/) and [R2 get bucket API](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/methods/get/) support per-resource checks. The [Pages deployment log API](https://developers.cloudflare.com/api/operations/pages-deployment-get-deployment-logs/) provides provider log history.

Removing `BOOKS_BUCKET` or returning a graceful null is not a solution: `apps/worker/src/routes/files.ts` reads EPUB bytes from R2, and ADR-1014 requires isolated preview R2 for the real chapter-reading journey. The repository cannot activate the Cloudflare account or create R2 resources while the account API is blocked by 10042.

## Decision

1. **Retain required resource bindings**: keep production and preview `BOOKS_BUCKET`, D1, and KV declarations in root `wrangler.toml`. Provision the referenced account resources; do not remove bindings to silence a failed deploy.
2. **Fail-closed resource preflight**: implement `scripts/preflight-cloudflare.mjs` and `pnpm preflight:cloudflare`. The script parses Wrangler's raw config, requires explicit `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, checks each D1/KV/R2 binding via resource-specific API calls, distinguishes 404 from permission/API/network errors, and treats only R2 error 10042 as R2 not provisioned. It never silently skips remote checks or mutates account resources.
3. **Gate the repository-managed Pages deploy**: run the preflight in `.github/workflows/lighthouse.yml` after build and before its Wrangler Pages deployment. Cloudflare's native Git integration remains a separate deploy path; the durable resolution for those deployments is creating the resources.
4. **Prevent the independent build regression**: pin `@intity/epub-js` to `0.3.96` in both consuming package manifests and `pnpm-lock.yaml`. The prior `^0.3.96` range let an unrelated Dependabot lock refresh resolve `0.3.103`, which did not provide declarations required by the reader build.
5. **Document operator diagnostics and activation**: add the Cloudflare deployment skill and update agent instructions/runbooks to retrieve provider logs, run the preflight, preserve runtime bindings, and require an account owner to activate R2 before creating both buckets.

## Consequences

- The repository-managed Lighthouse deployment stops before Wrangler deployment if any required resource is absent, inaccessible, or unverifiable.
- The Pages-native deployments still require `do-epub-studio-books` and `do-epub-studio-books-preview` to exist. Cloudflare's live 10042 response is an external blocker; this ADR does not claim the account has been repaired.
- Exact dependency pinning prevents the observed Dependabot lockfile regression without adding a local ambient type shim for a package version that failed the provider build.
- Production/preview storage isolation and the actual EPUB reading journey remain intact.
