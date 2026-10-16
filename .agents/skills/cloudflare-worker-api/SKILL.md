---
version: "1.0.0"
name: cloudflare-worker-api
description: >
  Structure Worker API routes and handlers. Activate for route definition,
  response helpers, and typed handler patterns. Auth belongs to secure-invite-and-access.
category: workflow
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Cloudflare Worker API

Provide a standardized structure for Worker routes, auth middleware, and response helpers.

## Key Responsibilities

- Define API routes and handlers.
- Implement auth middleware and session validation.
- Provide response helpers for consistent API responses.
- Design signed URL endpoints for secure file access.

## Interface Example

```ts
// Example route file structure
src/routes/
  access.ts
  books.ts
  comments.ts
  admin.ts
```

## Constraints

- No hardcoded secrets.
- All routes must be typed and validated.
- Use Zod for input validation.
- All responses must follow consistent format.

## Middleware Ordering

Observability middleware MUST precede path guards, CORS, security headers, and rate limiting. This ensures traceId is captured on every request — including 414 (URI Too Long) responses where the path-length guard rejects before other middleware runs.

Reference: `apps/worker/src/app.ts:23-33`

## Examples

### Route Definition

Typed Hono route with `Env` binding, `zValidator`, and the `{ ok, data }` envelope (from `apps/worker/src/routes/access.ts`):

```ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import { AccessRequestSchema } from '@do-epub-studio/shared';

export const accessRouter = new Hono<{ Bindings: Env }>();

accessRouter.post('/request', zValidator('json', AccessRequestSchema), async (c) => {
  const { bookSlug, email, password } = c.req.valid('json');
  // ...validate, create session...
  return c.json({
    ok: true,
    data: { sessionToken: session.token, expiresAt: session.expiresAt },
  });
});

// Error responses use the same envelope with ok: false
// return c.json({ ok: false, error: { code: 'ACCESS_DENIED', message: 'Access denied' } }, 401);
```

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "Register the path-length guard first so oversized URIs are rejected before anything else runs" | Observability middleware MUST precede path guards, CORS, security headers, and rate limiting, so traceId is captured on every request including 414 responses (`apps/worker/src/app.ts:23-33`). |
| "This endpoint can return a bare JSON object; the envelope is boilerplate" | Responses follow one format: `{ ok: true, data }` on success and `{ ok: false, error: { code, message } }` on failure. |
| "I'll implement the session check right in this route file" | Auth middleware and session validation boundaries belong to `secure-invite-and-access`; this skill owns routing, handler structure, and response helpers. |
| "Zod adds a dependency — I'll validate the body by hand" | Routes use `zValidator` with schemas from `@do-epub-studio/shared`, typed against the `Env` bindings; hand-rolled parsing is the anti-pattern. |
| "A hardcoded fallback key keeps local dev working" | There are no hardcoded secrets, including dev fallbacks — bindings come from the environment only. |

## Red Flags

- [ ] Observability/trace middleware is registered after CORS, security headers, rate limiting, or a path-length guard.
- [ ] A handler reads `c.env.*` without a typed `Env` binding.
- [ ] A response body is not the `{ ok, data }` or `{ ok: false, error }` envelope.
- [ ] The handler parses `c.req.json()` directly instead of `zValidator('json', SharedSchema)`.
- [ ] Session or signed-URL logic is duplicated into this layer instead of delegating to `secure-invite-and-access`.
- [ ] A new route file appears in `src/routes/` without being registered with the typed router in `apps/worker/src/app.ts`.
