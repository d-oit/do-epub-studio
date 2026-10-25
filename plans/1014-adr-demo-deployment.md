# ADR-1014: Isolated and complete preview demo provisioning

**Status:** Accepted

## Decision

- Production remains production: `ENVIRONMENT=production` always rejects demo seeding and demo-session endpoints. An allowlist never overrides that signal.
- Deployed demos use the existing distinct preview D1 binding and a distinct preview R2 bucket declared in the root Pages configuration. A provisioning command checks the target resources against production before any mutation.
- Demo administrator accounts remain disabled outside local development unless explicitly enabled for an isolated preview. Provisioning requires a deliberate admin option; runtime disabled/compromised-account and MFA guards remain intact.
- Preview provisioning applies schema migrations, invokes the existing account seed, uploads a generated valid sample EPUB, and records its file metadata. It must refuse to replace a non-demo book or user.
- Root builds explicitly pass and hash frontend demo variables. Autofill selects the configured demo book so it can be used from the default login route.
- Demo endpoints use the existing D1-backed rate-limit fallback when Pages has no Durable Object binding.

## Validation and consequences

Test environment/resource refusal before writes, default-disabled and explicitly enabled preview administrators, idempotent account/content provisioning, demo endpoint refusal in production, root-build flags and credential autofill. A local browser journey must read actual sample chapter text; login or toolbar visibility alone is insufficient.

Cloudflare resources and deployment secrets still require operator provisioning. Opening this PR does not create resources, seed a remote database or deploy a site.

An unavailable online audit is a validation gap, not a successful security check. Preserve the failing scanner and publish the change for review with the gap disclosed; required CI must complete before merge.
