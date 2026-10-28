# GOAP-1015: Cloudflare Deployment Remediation and Resource Preflight

**Status:** R2 account activated and buckets created (`do-epub-studio-books`, `do-epub-studio-books-preview`); token-authenticated preflight and Pages redeployment remain pending credentials/CI execution.
**ADR:** [ADR-1015](1015-adr-cloudflare-deployment-preflight.md)

## Goal

Resolve the Cloudflare Pages deployment failures across PRs and `main`. Diagnose every provider failure using Cloudflare deployment history, fix the separate build regression, preserve required runtime bindings, and establish fail-closed preflight checks and durable operator instructions.

## Sequence and Acceptance

- [x] **Failure analysis**: Fetch provider logs for all ten failed deployments. Nine failed at `deploy` because production or preview R2 buckets were missing; one failed at `build` on a Dependabot Sentry preview with TypeScript errors.
- [x] **R2 root cause**: Cloudflare R2 APIs return HTTP 403/code 10042 (`Please enable R2 through the Cloudflare Dashboard`). D1 production/preview and the configured KV namespace return HTTP 200. CLI bucket creation is blocked until the account owner activates R2.
- [x] **Independent build regression**: The Dependabot preview resolved `@intity/epub-js@0.3.103`, which lacks type declarations and produced TS7016 plus dependent TS7006 diagnostics. Pin the package to `0.3.96` in both consuming manifests and the lockfile; this preserves the already-working version and prevents unrelated lock refreshes from selecting the broken version.
- [x] **Preflight implementation**: Add `scripts/preflight-cloudflare.mjs` and `pnpm preflight:cloudflare`. Parse the actual Wrangler config, query per-resource D1/KV/R2 APIs, require explicit API token/account ID, classify missing resources separately from permission/network errors, and fail closed.
- [x] **Deployment path**: Run the preflight in `.github/workflows/lighthouse.yml` after build and before its Wrangler Pages deploy. Cloudflare's native Git integration remains independent; provisioning the required account resources is the actual fix for those native deployments.
- [x] **Regression tests**: Cover production/preview extraction, successful resource checks, 404s, R2 10042, non-404 permission failures, missing credentials and the current `wrangler.toml` contract.
- [x] **Skill and instructions**: Add `.agents/skills/cloudflare-deployment/SKILL.md`; update `.agents/AGENTS.md`, `scripts/AGENTS.md`, infrastructure/demo-preview runbooks, generated skill catalog, and project learnings.
- [x] **External account action**: Cloudflare account owner enabled R2 and created `do-epub-studio-books` and `do-epub-studio-books-preview` (verified via remote Wrangler CLI commands on 2026-10-28).
- [x] **Repository validation**: `pnpm vitest run scripts/__tests__` (114/114), `pnpm lint`, `pnpm typecheck` (7/7), `pnpm --filter @do-epub-studio/web build`, frozen-lockfile validation, workflow validation (17/17), hand-authored-file Prettier, agent-sync, skill-format (43 skills), ADR index and plan-reference checks passed. The generator-owned `agents-docs/AVAILABLE_SKILLS.md` contains the new entry; its generator formatting is preserved.
- [ ] **Post-provision live preflight & redeployment**: Rerun `pnpm preflight:cloudflare` and Pages redeployment using an explicit `CLOUDFLARE_API_TOKEN` that has D1, KV, and R2 read permissions. The local OAuth session cannot satisfy this check (`Authentication error`), so executing this step remains pending provisioning the API token in the environment or running via the GitHub Actions secret in CI.

## Deployment Evidence

Cloudflare Pages project `do-epub-studio`; failing deployment IDs and provider-log classifications:

| Deployment ID                          | Stage  | Finding                                                                                                                                                                          |
| -------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `52c16461-2729-44b1-8273-733ea69a0991` | deploy | Preview R2 bucket `do-epub-studio-books-preview` missing                                                                                                                         |
| `b166ddc5-b4b3-4449-b1b3-8bec19970565` | deploy | Preview R2 bucket `do-epub-studio-books-preview` missing                                                                                                                         |
| `ecef59f8-a939-4a0f-932e-8f09c4888d13` | deploy | Preview R2 bucket `do-epub-studio-books-preview` missing                                                                                                                         |
| `e1cd1445-5517-4275-bf97-27643a9a1b32` | deploy | Preview R2 bucket `do-epub-studio-books-preview` missing                                                                                                                         |
| `048548a0-cec6-4c93-ac71-389e246ca371` | deploy | Preview R2 bucket `do-epub-studio-books-preview` missing                                                                                                                         |
| `08fdbe08-9706-4e6f-94bb-59e098db7eac` | deploy | Production R2 bucket `do-epub-studio-books` missing                                                                                                                              |
| `8f2c91ca-da6d-470e-a5ec-023814552eb8` | deploy | Preview R2 bucket `do-epub-studio-books-preview` missing                                                                                                                         |
| `c3134c0d-09fc-4b00-87db-0de04c0f1624` | deploy | Preview R2 bucket `do-epub-studio-books-preview` missing                                                                                                                         |
| `eafd272b-e41c-4052-9619-f3fa3376dcda` | deploy | Preview R2 bucket `do-epub-studio-books-preview` missing                                                                                                                         |
| `e260d7d2-4412-40eb-be25-a5764d5f1e4e` | build  | Dependabot branch `dependabot/npm_and_yarn/sentry/cloudflare-11.9.0`; `@intity/epub-js@0.3.103` lacks declarations (TS7016), causing dependent implicit-any diagnostics (TS7006) |

## Official Cloudflare References

- [Pages Functions Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [R2 bucket creation](https://developers.cloudflare.com/r2/buckets/create-buckets/)
- [KV get namespace API](https://developers.cloudflare.com/api/resources/kv/subresources/namespaces/methods/get/)
- [R2 get bucket API](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/methods/get/)
- [Pages deployment log API](https://developers.cloudflare.com/api/operations/pages-deployment-get-deployment-logs/)
