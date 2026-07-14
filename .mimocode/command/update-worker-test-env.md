---
name: update-worker-test-env
description: Update worker test Env mocks when wrangler.jsonc bindings change (TURSO_DATABASE_URL, SENDER_EMAIL, etc.)
triggers:
  - update test env
  - fix worker test mocks
  - wrangler bindings changed
  - worker-configuration.d.ts
  - env mock missing
  - test fixture env
params:
  - name: action
    description: "regenerate (regenerate types + update mocks) or mocks-only (just update test files)"
    default: regenerate
---

# Update Worker Test Env Mocks

When `wrangler.jsonc` bindings change (new env vars, new services, renamed fields),
the generated `worker-configuration.d.ts` and all test `Env` mocks must be updated.
CI generates types from wrangler.jsonc, so mismatches cause typecheck failures.

## Step 1 — Check if types need regeneration

```bash
# Compare current vs expected types
cd apps/worker
npx wrangler types --env-interface CloudflareEnv src/worker-configuration.d.ts --no-strict-vars
git diff src/worker-configuration.d.ts
```

If there are diffs, the committed types were stale. Proceed to Step 2.

## Step 2 — Regenerate worker-configuration.d.ts

```bash
cd apps/worker
npx wrangler types --env-interface CloudflareEnv src/worker-configuration.d.ts --no-strict-vars
git add src/worker-configuration.d.ts
```

## Step 3 — Ensure wrangler.jsonc vars are complete

CI generates types from wrangler.jsonc, so ALL non-secret env vars must be in the
`vars` section — even if they're empty strings for local dev.

```bash
# Check what's in vars
grep -A 20 '"vars"' apps/worker/wrangler.jsonc
```

Required vars (always present):
- `TURSO_DATABASE_URL` — use `'file::memory:'` for tests
- `TURSO_AUTH_TOKEN` — use `''` or `'test-token'`

If any are missing, add them to wrangler.jsonc vars section.

## Step 4 — Update all test Env mocks

Every test file that constructs an `Env` mock must include all required fields.
Find all files:

```bash
grep -rn "makeEnv\|as Env\|Env {" apps/worker/src/__tests__/ --include="*.ts"
```

For each file, ensure the Env mock includes:

```typescript
{
  // Existing fields...
  TURSO_DATABASE_URL: 'file::memory:',
  TURSO_AUTH_TOKEN: 'test-token',
  SENDER_EMAIL: {} as any,
  // ... other bindings as needed
}
```

### Common test files to update

- `apps/worker/src/__tests__/fixtures.ts` — central `makeEnv()` helper
- `apps/worker/src/__tests__/middleware.test.ts` — inline env or makeEnv()
- `apps/worker/src/__tests__/password-coverage.test.ts` — inline env
- `apps/worker/src/__tests__/rate-limit-client.test.ts` — makeEnv()
- `apps/worker/src/__tests__/edge-cache.test.ts` — inline env

## Step 5 — Fix makePassThroughContext if needed

After types regeneration, `ExecutionContext` may require new properties:

```bash
grep -n "makePassThroughContext" apps/worker/src/__tests__/fixtures.ts
```

If `tracing` is now required:
```typescript
export function makePassThroughContext() {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
    tracing: {} as Tracing,  // Added after types regeneration
  };
}
```

## Step 6 — Remove unnecessary type assertions

After regenerating types, `as Env` / `as unknown as Env` assertions may become
unnecessary (TypeScript can infer the return type). ESLint will flag these:

```bash
pnpm lint 2>&1 | grep "no-unnecessary-type-assertion"
```

If flagged, remove the assertion — the mock already satisfies the type.

## Step 7 — Verify

```bash
# Typecheck
pnpm --filter worker typecheck

# Lint
pnpm --filter worker lint

# Tests
pnpm --filter worker test
```

## Reference

- Types source of truth: `apps/worker/wrangler.jsonc` (bindings + vars)
- Generated types: `apps/worker/src/worker-configuration.d.ts`
- Env definition: `apps/worker/src/lib/env.ts` (Env extends CloudflareEnv)
- Central test helper: `apps/worker/src/__tests__/fixtures.ts` (makeEnv)
- AGENTS.md: TIER 1 — "MUST always fix pre-existing issues when encountered"
