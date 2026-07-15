# ADR: Cloudflare Versus Turso Local Development

Status: Proposed  
Date: 2026-07-14

## Context

The project is deployed on Cloudflare Workers and is governed by repository rules that require signed resource access, trace IDs on Worker requests, security headers on all responses, D1/R2-safe resource handling, and immediate session revocation on grant changes.

The user asked whether Cloudflare is being used with best practices or whether the project should switch to Turso using Turso local development guidance.

## Decision

Do not switch the whole platform from Cloudflare to Turso.

Keep Cloudflare Workers and Cloudflare-native resource handling as the default platform. Evaluate Turso/libSQL only as a scoped relational database option if the audit proves D1 local development, database branching, or test isolation is a concrete blocker.

## Rationale

- Turso does not replace Workers, R2, signed file access, security headers, or edge request handling.
- A database-only migration would add runtime secrets, networked database access, migration tooling, CI changes, and operational complexity.
- D1 remains the most direct fit when the Worker is already the request boundary and database locality is sufficient.
- Turso local development can be valuable if the project needs libSQL-compatible local parity, branch-like database workflows, or stronger isolated test databases than the current D1 workflow provides.

## Alternatives Considered

- Full migration from Cloudflare data services to Turso: rejected because it does not cover R2 or Worker platform requirements and would increase blast radius.
- Hybrid Cloudflare Workers plus Turso database: reserved for future adoption if concrete D1 local development or branching limitations are documented.
- Status quo Cloudflare D1/R2/KV only: accepted as default unless the audit finds specific reproducibility or scaling issues.

## Consequences

- Platform recommendations should focus first on Cloudflare best-practice gaps.
- Turso should not be introduced just for novelty or because local-development documentation exists.
- Any future Turso proposal must include a migration plan, secret model, CI database strategy, rollback plan, and Worker latency assessment.

## Verification

- Confirm no existing Turso/libSQL dependency is partially implemented or unused.
- Confirm D1 migrations and local development commands are documented and reproducible.
- Confirm Cloudflare resource access follows the security controls listed in `plans/178-goap-platform-data-audit.md`.
