# ADR-078: Zod Schema Centralization in `@do-epub-studio/schema`

> **Status:** Accepted (2026-06-15)
> **Supersedes:** none
> **Related:** ADR-034 (ReDoS hardening), `analysis/SWARM_ANALYSIS.md` G20
> **Deciders:** maintainers

## Context

Five inline Zod schemas remain in Worker routes:

- `routes/admin/auth.ts:12-15` — `LoginSchema`
- `routes/access.ts:249-251` — `ValidateQuerySchema`
- `routes/files.ts:11-14` — `SignedUrlSchema`
- `routes/admin/books.ts:12-25` — `UploadCompleteSchema`
- `middleware/validation.ts:4-13` — `formatZodError` helper

The pattern of "all request validation lives in
`@do-epub-studio/schema`" was established by ADR-035 and the
2026-Q2 work. These five are the only residuals. They:

1. Drift from the canonical request shape (no shared definition
   to update).
2. Cannot be reused by the web client (which would have to
   duplicate them).
3. Don't get the safe-regex / length guards applied at the
   schema layer.

## Decision

We move all five to `packages/schema/src/schemas.ts` and
expose `formatZodError` from `@do-epub-studio/shared` (next to
`AppError`).

### New exports

```ts
// packages/schema/src/schemas.ts
export const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
});

export const ValidateQuerySchema = z.object({
  bookSlug: z.string().min(1).max(120),
});

export const SignedUrlSchema = z.object({
  expires: z.coerce.number().int().positive().max(2 ** 32),
  signature: z.string().min(16).max(256),
});

export const UploadCompleteSchema = z.object({
  fileKey: z.string().min(1).max(256),
  size: z.number().int().positive().max(200 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  // ... existing fields
});

// packages/shared/src/errors.ts
export function formatZodError(err: z.ZodError): {
  code: 'VALIDATION_ERROR';
  message: string;
  details: Array<{ path: string; message: string }>;
}
```

### Migration

Each route file changes from:

```ts
import { z } from 'zod';
const LoginSchema = z.object({...});
```

to:

```ts
import { LoginSchema } from '@do-epub-studio/schema';
```

No request-handler logic changes. Tests already in place
(`routes.admin.test.ts`, `validation.test.ts`) must continue
to pass.

## Consequences

### Positive

- Single source of truth for request shapes.
- Web client can use the same schema for client-side validation
  in a follow-up PR (out of scope here).
- ADR-034 length guards are applied at the schema layer rather
  than re-implemented per route.

### Negative

- One cross-package import edge; the dependency graph already
  has `worker → schema` for the other 30+ schemas, so this is
  a non-change.

### Neutral

- No D1 / Drizzle / runtime changes.

## Compliance

- AGENTS.md TIER-1 — "All input validation lives in shared Zod
  schemas" is now literally true.
- ADR-034 — length guards are applied at the schema layer.
