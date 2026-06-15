# ADR-075: Tenant Isolation for URL `bookId` and Locator Read-Validation

> **Status:** Accepted (2026-06-15)
> **Supersedes:** none
> **Related:** ADR-006 (multi-signal locators), ADR-004
> (auth and access), `analysis/SWARM_ANALYSIS.md` G14, G16, G22
> **Deciders:** maintainers, security reviewer
> **Tags:** security, authz, tenant-isolation, ADR-006

## Context

The 2026-06-15 swarm analysis identified three tenant-isolation
gaps in the Worker API:

- **G14 — Comments IDOR.** `routes/comments.ts` runs
  `requireAuth` and queries `comments` by the **URL** `bookId`
  without re-checking that the session user has a grant for that
  book. A reader with a grant for book A can read or post
  comments on every book, including `internal` visibility rows.
- **G16 — Locator not re-validated on read.** Storing and
  returning `*_locator_json` uses `JSON.parse(...) as Record<string, unknown>`.
  The multi-signal guarantee from ADR-006 is enforced on **write**
  only. A bad row returns a malformed locator, breaking
  re-anchoring and CFI navigation.
- **G22 — URL `bookId` vs session `bookId` mismatch in
  reader-state POSTs.** `routes/reader/{progress,bookmarks,highlights}.ts`
  use the URL `bookId` in the INSERT without asserting that the
  session's `bookId` (the book the user is **scoped to** by
  their session token) matches the URL.

These three are the same architectural pattern: **a write
path trusts URL parameters without re-validating the session's
scope**.

## Decision

We adopt a single invariant for all Worker routes that operate
per-book:

> **Invariant 075.1** — A request that carries a URL `:bookId`
> parameter and is authenticated by `readerAuth` MUST have
> `auth.bookId === :bookId`. If they differ, return
> `403 FORBIDDEN` with code `BOOK_SESSION_MISMATCH`.
>
> **Invariant 075.2** — A read that returns rows containing
> locator JSON MUST re-validate each row's `*_locator_json` with
> `MultiSignalLocatorSchema.parse()` inside a try/catch. On
> failure, log a `corrupt_locator` audit event and exclude the
> row from the response.
>
> **Invariant 075.3** — A request that mutates or reads a
> `comments` row MUST join against `book_access_grants` filtered
> by the session user's email and the URL `:bookId`. A row whose
> `book_id` is not covered by an active grant is invisible
> to that user.

### Implementation sketch

```ts
// helpers/tenant-isolation.ts (new)
export async function assertBookAccess(
  env: Env,
  auth: SessionContext,
  bookId: string,
): Promise<void> {
  if (auth.bookId !== bookId) {
    throw new AppError('FORBIDDEN', 'BOOK_SESSION_MISMATCH', 403);
  }
  const grant = await queryFirst(env,
    `SELECT 1 FROM book_access_grants
     WHERE book_id = ? AND email = ? AND revoked_at IS NULL
     LIMIT 1`,
    [bookId, auth.email]);
  if (!grant) {
    throw new AppError('FORBIDDEN', 'NO_GRANT_FOR_BOOK', 403);
  }
}

export async function parseLocatorRow(
  env: Env,
  raw: string | null,
): Promise<AnnotationLocator | null> {
  if (!raw) return null;
  try {
    return MultiSignalLocatorSchema.parse(JSON.parse(raw));
  } catch (err) {
    await logAudit(env, {
      entityType: 'book',
      entityId: 'unknown',
      action: 'corrupt_locator',
      payload: { error: String(err) },
    });
    return null;
  }
}
```

The helper is added to `apps/worker/src/lib/tenant-isolation.ts`
and used by `routes/comments.ts`, `routes/reader/progress.ts`,
`routes/reader/bookmarks.ts`, `routes/reader/highlights.ts`.

### Tests

Three new test files; each must fail before the fix.

- `__tests__/tenant-isolation.comments.test.ts` — reader A's
  session for book A cannot read or post comments on book B.
- `__tests__/tenant-isolation.locator.test.ts` — a planted
  malformed `*_locator_json` row is excluded and a
  `corrupt_locator` audit event is emitted.
- `__tests__/tenant-isolation.reader-state.test.ts` — URL
  `bookId` mismatching session `bookId` returns 403 in
  progress, bookmarks, and highlights POSTs.

## Consequences

### Positive

- Closes the only three remaining tenant-isolation gaps in the
  Worker API.
- Restores the ADR-006 guarantee end-to-end (write + read).
- Provides a single `assertBookAccess` helper that future
  routes can adopt by default.

### Negative

- Adds one D1 read per request on the affected paths. The
  `book_access_grants` table is small per book and has the
  composite index `(book_id, email, revoked_at)`; the read is
  sub-millisecond.
- Reading a corrupt locator now silently drops the row. We
  mitigate by emitting a `corrupt_locator` audit event so the
  admin can find and fix the row.

### Neutral

- The `auth.bookId` field already exists on the session
  context; no schema change is needed.

## Compliance

- **AGENTS.md TIER-1:** "MUST use multi-signal locators" is
  restored on the read path.
- **ADR-006:** invariants 1 and 2 (multi-signal) and invariant 3
  (bookId scoping) are now enforced on every read and write.
- **AGENTS.md TIER-2 rule 8:** documented as a GOAP plan + ADR
  (this file).
