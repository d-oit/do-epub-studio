# ADR: Cloudflare-Native Data Layer With Scoped Turso Evaluation

Status: proposed
Date: 2026-07-14

## Context

The project is deployed around Cloudflare Workers and has strict security requirements for resource access, sessions, trace IDs, parser safety, and CI. Turso offers a strong local development workflow for libSQL-backed applications, including a local database workflow documented at `https://docs.turso.tech/local-development`. The Turso local workflow centers on running a local `sqld` instance through `turso dev`, using local libSQL URLs, and optionally creating local replicas from remote databases for development.

The question is whether the project should switch from Cloudflare-native data services to Turso or use Turso only where it improves developer experience.

## Decision

Keep Cloudflare-native services as the default platform. Evaluate Turso as a scoped relational database option only when the audit identifies a concrete D1 or local-development gap that Turso solves better without weakening Worker integration, security posture, CI, or operational simplicity.

## Alternatives Considered

- Full switch to Turso: rejected for now because it would create a larger platform migration before there is evidence that D1 or current local development blocks delivery.
- Keep Cloudflare only with no Turso evaluation: rejected because Turso may improve local database workflows, branching, and SQLite-compatible development if current D1 workflow is painful.
- Hybrid evaluation: accepted because it preserves Cloudflare strengths while allowing evidence-based adoption of Turso where it adds value.

## Consequences

- R2 protected file delivery remains Worker-mediated.
- Worker route, auth, signed URL, and security header practices remain the primary platform standard.
- Any Turso proof of concept must include migrations, local dev setup, CI setup, secret handling, and rollback criteria.
- A Turso proof of concept should specifically test `turso dev` or local libSQL connection strings against the repository's migration and test harness.
- No production data migration should start until the GOAP audit identifies a specific problem statement and acceptance tests.

## Verification

- Confirm local database commands work from a fresh checkout.
- Confirm CI can run migrations and tests without external secrets unless explicitly configured.
- Confirm Worker runtime access does not expose raw database credentials to clients.
- Confirm quality gate, workflow validation, Codacy, and PR checks pass.
