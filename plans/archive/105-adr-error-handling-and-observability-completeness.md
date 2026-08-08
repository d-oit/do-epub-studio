# ADR-105: Error-Handling, Logging Redaction & Observability Completeness Policy

> **Status:** Accepted (2026-06-23)
> **Supersedes:** none
> **Extends:** ADR-067 (Observability Adoption), ADR-034 (ReDoS Hardening),
> ADR-035a (CSP)
> **Related:** `plans/105-goap-comprehensive-codebase-audit-2026-06-23.md`,
> `apps/worker/src/middleware/observability.ts`,
> `packages/shared/src/errors.ts`, `packages/shared/src/telemetry.ts`,
> `apps/web/src/lib/client-logger.ts`
> **Deciders:** maintainers
> **Tags:** observability, error-handling, security, logging

## Context

The 2026-06-23 comprehensive audit (GOAP 105) found that the
observability foundation is in place but **not uniformly enforced**:

1. **Typed errors are defined but unused.** `packages/shared/src/errors.ts`
   exports `AppError` and typed subclasses plus `toApiError()`, but worker
   and web production code never use them; routes return ad-hoc JSON and the
   central catch (`apps/worker/src/middleware/observability.ts:18-32`) maps
   everything to a generic `500`, losing the typed status/code/message.
2. **traceId is not on *every* response.** The path-length guard
   (`apps/worker/src/app.ts:21-27`) returns `414` before the observability
   middleware runs, and a route-level catch
   (`apps/worker/src/routes/reader/insights.ts:86-89`) returns `500` without
   `traceId`. AGENTS.md TIER-1 requires traceId on every Worker request.
3. **No log redaction.** Worker logs serialize full error messages and
   stacks (`lib/observability.ts:93-108`, `telemetry.ts:38-50`); web
   telemetry emits arbitrary metadata and stacks to the telemetry endpoint
   (`client-logger.ts`). Neither scrubs secrets/tokens/PII.
4. **Inconsistent logging surfaces.** Production code uses raw `console.*`
   in several places, and some critical UI events use static pseudo
   trace IDs (`'session'`, `'reader-search'`) instead of generated ones.

There was no written policy stating *how* errors and logs must flow, so
each new route/component made an independent (and divergent) choice.

## Decision

### 1. Typed errors are the contract

- Worker route handlers that fail in a *known* way MUST throw a
  `packages/shared/src/errors.ts` subclass (`ValidationError`,
  `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`,
  `RateLimitError`). The central observability catch MUST call
  `toApiError()`/`isAppError()` to preserve the typed HTTP status and
  `code`, falling back to `INTERNAL_ERROR` 500 only for unknown errors.
- Ad-hoc `c.json({ ok: false, error: … }, 5xx)` inside route catches is
  discouraged; prefer throwing a typed error so the central handler owns the
  envelope (and the traceId).

### 2. traceId on every response — no exceptions

- Every Worker response, **including pre-route guards** (path-length, CORS
  preflight rejection, rate-limit 429), MUST carry `x-trace-id`/`x-span-id`
  headers and, for error bodies, `error.traceId`.
- Practically: guards that can short-circuit MUST run *after*
  `createRequestContext`, or attach trace headers themselves. The 414
  path-length guard is the canonical case to fix.
- Critical UI actions (per AGENTS.md TIER-1) MUST use a **generated**
  trace ID via the shared telemetry helpers, never a hardcoded string.

### 3. Redaction is mandatory before any log sink

- A single redaction/scrubber function MUST run inside the worker `log()`
  path and the web `client-logger` before writing to console or the
  telemetry endpoint. It MUST strip, at minimum: bearer tokens,
  `Authorization` values, signing secrets, signed-URL signatures, and
  email addresses (privacy boundary, ADR-102-aligned).
- Error stacks MAY be logged but message/metadata MUST pass through the
  scrubber first.

### 4. One logging surface per runtime

- Worker production code MUST log via `lib/observability.ts` (or a thin
  wrapper), not raw `console.*`. Web production code MUST log via
  `logClientEvent`/`client-logger`, not raw `console.*`.
- `eslint` `no-console` SHOULD be tightened (warn → error for `log`) once
  existing call sites are migrated, so the rule enforces this decision.

### 5. Sampling is allowed, silence is not

- High-volume request/client logs MAY be sampled, but a swallowed error
  (empty/`catch {}` with no telemetry) MUST be justified with an inline
  comment explaining why it is safe to ignore.

## Consequences

### Positive

- Known failures return correct HTTP status/codes; clients can branch on
  `error.code` instead of guessing from 500s.
- Every request/action is traceable end-to-end, satisfying the TIER-1
  traceId rule including edge-case guards.
- Logs cannot leak secrets/PII by default; redaction is centralized, not
  per-call-site discipline.
- New routes/components inherit a single, documented pattern.

### Negative

- Migration touches many existing route handlers and UI catch blocks
  (sequenced as GOAP 105 tasks T3, D2b/D2c/D3/D4); it is incremental, not a
  big-bang rewrite.
- A redaction layer adds a small per-log cost; mitigated by running only on
  the fields that need it.

### Neutral

- The shared `errors.ts` / `telemetry.ts` modules already exist; this ADR
  mandates *use*, not new infrastructure.

## Compliance

- AGENTS.md TIER-1 — "emit traceId on every Worker request and critical UI
  action"; "guard every regex against untrusted input" (ReDoS sweep is a
  sibling GOAP-105 task, governed by ADR-034).
- AGENTS.md TIER-2 rule 8 — recorded as a GOAP plan + ADR.
- ADR-102 — email/PII redaction aligns with reading-insights privacy
  boundaries.
