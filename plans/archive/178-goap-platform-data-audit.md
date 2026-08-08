# GOAP: Platform Data Audit

Status: ✅ COMPLETED (Plan 197 verified 2026-07-18 — audit findings resolved via Plans 186-196)
Date: 2026-07-14

## Goal

Verify that d.o.EPUB Studio uses Cloudflare services with production-grade patterns and decide whether Turso/libSQL should be introduced for local database development.

## Observed Scope

- Cloudflare Worker configuration and bindings must be reviewed in `wrangler.toml`.
- Worker runtime code must be reviewed for D1, R2, KV, Durable Objects, cache, signed URL, security header, trace ID, and local development behavior.
- Database migration and schema code must be reviewed before recommending D1, Turso, or a hybrid.
- The Turso local development documentation should be treated as an evaluation input, not as a migration requirement by itself.

## Obstacles

- Cloudflare-native resources are part of the product security model, especially Workers and protected file access.
- A full Turso migration would affect database bindings, secrets, migrations, tests, CI, local development, and runtime latency.
- R2 and signed URL behavior cannot be replaced by Turso; Turso can only address relational database development and deployment concerns.

## Actions

1. Inventory platform bindings in `wrangler.toml` and environment-specific Worker configuration.
2. Inventory Worker data access code for D1, R2, KV, Durable Objects, cache, and any direct SQLite/libSQL/Turso dependencies.
3. Verify Cloudflare best-practice controls:
   - trace ID is emitted before path-length rejection
   - R2 URLs are never exposed directly to clients
   - signed URL flows are used for protected resources
   - sessions are revoked immediately on grant changes
   - security headers and CSP are applied to every response, including static responses
   - untrusted regexes use bounded helpers
   - EPUB parsing has timeout controls
   - migrations are deterministic in CI and local development
4. Compare D1 local development with Turso local development for this project’s actual pain points:
   - schema parity
   - migration repeatability
   - local test isolation
   - branch or preview database ergonomics
   - Worker runtime access and latency
   - secret handling and CI complexity
5. Keep Cloudflare-native services unless the audit proves Turso materially improves database development without weakening Worker/R2/security guarantees.

## Proof Commands

- `git status --short --branch`
- `git fetch origin main && git merge origin/main`
- `grep -R "D1\|R2\|KV\|Durable\|TURSO\|LIBSQL" wrangler.toml packages apps .github scripts`
- `./scripts/validate-workflows.sh`
- `./scripts/quality_gate.sh`

## Acceptance Criteria

- A complete binding and data-flow inventory exists in this plan or a follow-up linked from it.
- `plans/179-adr-cloudflare-vs-turso-local-development.md` records the platform decision.
- Any Cloudflare best-practice gap is either fixed or tracked by a GOAP plan and ADR before merge.
- All required CI and Codacy checks pass before merge.
