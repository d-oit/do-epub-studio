# ADR-233: Demo Account Sandbox Policy

**Date:** 2026-08-13
**Status:** Accepted
**Deciders:** Project maintainer, security reviewer, product owner
**Related:** GOAP-230, ADR-004, ADR-092, ADR-106, ADR-231, ADR-232, ADR-234

## Context

The user requested demo accounts for reader and admin. The repository currently
has test fixtures with example reader/admin identities, but no production seed
workflow and no demo-account migrations.

Demo accounts are useful for QA, preview deployments, and stakeholder review.
They are also risky if implemented as tracked credentials, permanent admin
users, or migrations that run in production.

## Decision

Demo accounts must be created only through an explicit, environment-gated seed
workflow. They must never be inserted by baseline schema migrations and must
never use tracked passwords.

Implementation must provide:

1. A seed command that refuses to run unless `DEMO_ACCOUNTS_ENABLED=1` and the
   environment is local, ephemeral preview, or an explicitly allowlisted demo
   environment.
2. Separate reader and admin demo accounts with generated UUIDs and lowercase
   reserved-domain email identifiers.
3. Operator-provided passwords through local environment variables or generated
   one-time output in local development only.
4. Argon2id password hashing through the same auth helper used by production.
5. A demo reader grant scoped to a demo book with bounded permissions.
6. A demo admin account that is disabled by default outside local development.
7. Cleanup/reseed behavior that revokes existing demo sessions and resets demo
   state idempotently.
8. Tests proving the seed command fails closed in production-like environments.

## Demo Permission Boundaries

- Reader demo may read and exercise comments/highlights only for the demo book.
- Reader demo must not receive access to uploaded private books.
- Admin demo may be enabled for local and preview QA, but must not be available
  in production.
- Demo accounts must be visually identifiable in admin audit views without
  exposing credentials.

## Alternatives Considered

### Hardcode demo credentials

Rejected. Tracked credentials become live secrets as soon as a preview or fork
deploys them.

### Add demo accounts in SQL migrations

Rejected. Migrations run as production schema history. Demo data belongs in an
explicit seed workflow with environment checks.

### Reuse test fixtures as demo accounts

Rejected. E2E fixtures mock APIs and are not an operational account lifecycle.

## Consequences

### Positive

- QA can exercise reader and admin flows without manual setup.
- Production cannot accidentally inherit demo credentials.
- Demo data remains disposable and auditable.

### Negative

- Requires a seed command, docs, and CI tests.
- Preview environments need explicit secret provisioning or generated-password
  retrieval.

## Acceptance Criteria

- Seed command fails when production indicators are present.
- Generated passwords are never written to the repository, migrations, audit
  logs, telemetry, or test snapshots.
- Reseeding revokes prior demo sessions.
- Demo admin cannot modify non-demo content unless explicitly configured for a
  throwaway preview database.
