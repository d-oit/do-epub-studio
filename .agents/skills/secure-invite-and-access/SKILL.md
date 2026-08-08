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

Purpose: enforce access-control rules (grants, passwords, sessions, signed URLs, audit) for `d.o.EPUB Studio`.

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

## Examples

### Grant Check

The `/api/access/request` handler validates the grant then clears failure counters on success (from `apps/worker/src/routes/access.ts`):

```ts
// 1. Rate-limit by email (5 req/60 s)
const rateLimit = await checkRateLimitDO(c.env, 'auth_access', emailKey,
  { maxRequests: 5, windowMs: 60_000 });
if (!rateLimit.allowed) return c.json({ ok: false,
  error: { code: 'TOO_MANY_REQUESTS', message: '...' } }, 429);

// 2. Validate grant (Argon2id password check + expiry + revocation)
const result = await validateGrant(c.env, bookSlug, emailKey, password);
if (!result.valid) { /* log audit, increment auth_failures counter */ }

// 3. On success: clear failure + lockout counters, create session
await Promise.all([
  deleteRateLimitKey(c.env, 'auth_failures', emailKey),
  deleteRateLimitKey(c.env, 'auth_lockout', emailKey),
]);
const session = await createSession(c.env, result.book.id, email);
return c.json({ ok: true, data: { sessionToken: session.token, ...capabilities } });
```

### Lockout

After 5 consecutive failures the `auth_lockout` namespace blocks the account for 15 minutes (from `apps/worker/src/routes/access.ts`):

```ts
// Check lockout before attempting credential validation
const lockoutCheck = await checkRateLimitDO(c.env, 'auth_lockout', emailKey,
  { maxRequests: 1, windowMs: 900_000 });
if (!lockoutCheck.allowed) {
  const retryAfter = Math.ceil((lockoutCheck.resetAt - Date.now()) / 1000);
  return c.json({ ok: false,
    error: { code: 'ACCOUNT_LOCKED', message: '...' } }, 423,
    { 'Retry-After': String(retryAfter) });
}

// On the 5th failure, write to auth_lockout so the next attempt is blocked
const failureCheck = await checkRateLimitDO(c.env, 'auth_failures', emailKey,
  { maxRequests: 5, windowMs: 900_000 });
if (!failureCheck.allowed) {
  await checkRateLimitDO(c.env, 'auth_lockout', emailKey,
    { maxRequests: 1, windowMs: 900_000 });
}
```
