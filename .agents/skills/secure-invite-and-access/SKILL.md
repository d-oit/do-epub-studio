---
version: "1.0.0"
name: secure-invite-and-access
description: >
  Implement grants, Argon2id passwords, sessions, and signed URLs per ADR-004.
  Activate for auth changes, access endpoints, or permission revocation.
category: workflow
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Skill: `secure-invite-and-access`

Purpose: enforce access-control rules (grants, passwords, sessions, signed URLs, audit) for `do EPUB Studio`.

## When to run

- Working on `/api/access/*`, grant management, or session/token logic.
- Updating signed URL issuance/verification or audit logging.
- Investigating auth-related bugs or observability gaps.

## Inputs

- `plans/004-adr-auth-and-access.md`
- `packages/shared/src/schemas.ts`
- Worker auth modules (`apps/worker/src/auth/*`)

## Workflow

1. **Re-read ADR** – confirm grant modes, capability flags, TTL expectations.
2. **Threat model** – identify enumeration risks, replay attacks, session leakage.
3. **Implement** – Argon2id hashing, session issuing/refresh/revoke, signed R2 URLs (<15 min TTL), `X-Trace-Id` logging.
4. **Audit** – log `grant_*`, `access_*`, `session_*` events w/ actor + trace.
5. **Responses** – return generic access-denied errors; never leak whether email exists.
6. **Tests** – add Vitest coverage for password validation, session expiry, signature validation, revocation flows.

## Checklist

- [ ] All auth endpoints validate payloads with Zod + capability checks.
- [ ] Sessions + signed URLs include expiry metadata and trace IDs.
- [ ] Logout/refresh revoke existing tokens.
- [ ] Audit rows created for create/update/revoke/grant usage.
- [ ] Rate limiting or abuse guard documented (even if stubbed now).
