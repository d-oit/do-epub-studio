# GOAP: Platform And Data Architecture Audit

Status: proposed
Date: 2026-07-14

## Goal

Verify that d.o.EPUB Studio uses Cloudflare platform services safely and consistently, and decide whether Turso/libSQL local development should replace or supplement the current database approach.

## Observed Scope

This audit covers Worker runtime configuration, storage bindings, schema migrations, local development, signed resource access, security headers, trace IDs, parser safety, and CI validation. The implementation pass must refresh evidence from:

- `wrangler.toml`
- `.github/workflows/`
- `scripts/quality_gate.sh`
- `scripts/validate-workflows.sh`
- Worker route handlers under the app source tree
- schema and migration packages
- auth, grants, session, signed URL, and EPUB parsing code paths

## Current Hypothesis

Cloudflare should remain the default platform when the product relies on Workers, R2, D1, and edge-local request handling. Turso should be evaluated as a database-layer supplement only if it solves a demonstrated problem in local development, branching, SQLite compatibility, or test isolation that D1 tooling does not solve.

## Actions

1. Refresh repository state with `git fetch origin main && git merge origin/main` before changing files.
2. Inventory every Cloudflare binding and environment-specific setting in `wrangler.toml`.
3. Trace all reads and writes through database, object storage, and cache layers.
4. Verify that clients never receive raw R2 URLs and that protected resources use signed Worker-mediated URLs.
5. Verify trace IDs are emitted before path-length guards and on critical UI actions.
6. Verify security headers, HSTS, and CSP defaults apply to every response, including static responses.
7. Verify EPUB parsing has explicit parser timeouts and regex guards through `matchBounded` or `testBounded` for untrusted input.
8. Compare D1 local development to Turso local development for reproducibility, migration discipline, CI setup, secrets exposure, and Worker integration.
9. Document any concrete migration blockers or local developer pain points with file-level evidence.

## Acceptance Criteria

- Every Cloudflare binding has a documented purpose and environment boundary.
- Every protected object access path is Worker-mediated and signed.
- Every database access path has a clear local development and CI story.
- Any Turso recommendation is backed by a specific gap, not preference.
- Any security or platform gap becomes either a code fix in the current PR or a linked GOAP follow-up.

## Verification

- `./scripts/validate-workflows.sh`
- `./scripts/quality_gate.sh`
- `codacy pull-request gh d-oit do-epub-studio <PR> --output json`
- `gh pr checks <PR>`

## Recommendation

Do not switch the entire platform away from Cloudflare. Keep Workers and R2 as the deployment and protected-file delivery foundation. Consider Turso only for the relational database layer if D1 local development, branchable databases, or libSQL parity are proven blockers after the evidence pass.
