# Observability

> **Status:** adopted (per ADR-092, GOAP plan #092)
> **Audience:** operators, on-call, future maintainers
> **Last reviewed:** 2026-07-28

This page documents the client telemetry contract for
`do-epub-studio`.

## What the client emits

`apps/web/src/lib/client-logger.ts` is the single entry point for
client-side telemetry. The `logClientEvent` function accepts a
typed `ClientLogEntry` and buffers it in memory. On
`visibilitychange=hidden` or `beforeunload`, the buffer is flushed.

- Buffer is in-memory; not persisted across reloads.
- The buffer is **dropped on the floor** when no endpoint is
  configured. This is intentional — telemetry must never break the
  app.
- Flush uses `navigator.sendBeacon()` if available, otherwise
  `fetch(..., { keepalive: true })`.

## The `VITE_TELEMETRY_ENDPOINT` contract

- Build-time environment variable read by Vite at bundle time.
- If unset, the client emits nothing to the network; the buffer
  is still populated for any code that needs to inspect it
  (e.g. tests).
- If set, the client flushes `{ logs: ClientLogEntry[] }` as JSON
  to that URL on the events listed above.
- The endpoint is **external by default** per ADR-092 D3.
  Examples: a managed log collector, a Cloudflare Worker you
  operate, a third-party observability service.

### Worker-hosted `/api/telemetry`

The worker provides a built-in `POST /api/telemetry` endpoint that:

1. Requires **no authentication** (telemetry does not carry
   sensitive data per the sanitization rules below).
2. Validates the payload with `TelemetryPayloadSchema` (Zod).
3. Persists events to the `telemetry_events` table in Turso
   using `waitUntil` for non-blocking writes (does not delay the
   response).
4. Returns `202 Accepted` with `{ ok: true }`.

The endpoint uses `LoggingEmailTransport` semantics — it also logs
each event to `console.log/warn/error` for observability in `wrangler tail`.

**When to configure `VITE_TELEMETRY_ENDPOINT` to the worker:**
- You want correlated client-server traces (the client sends
  `X-Trace-Id` headers on API calls and the same traceId in
  telemetry events).
- You want to query telemetry events via admin audit views.
- You accept the telemetry retention policy (see below).

**Retention:** Telemetry events in the `telemetry_events` table have
no automated retention policy in the initial implementation.
Operators should add a periodic cleanup job or TTL-based eviction
if volume becomes an issue. Suggested: DELETE events older than
90 days.

## What NOT to send

Per AGENTS.md Tier 1 and ADR-092:

- No session tokens (Bearer credentials).
- No magic-link recovery tokens.
- No book content excerpts that could be copyrighted or
  identify the reader.
- No personal data beyond `metadata` keys the developer explicitly
  opts into (e.g. `bookId` for error correlation is fine;
  `email` is not).

The `ClientLogEntry.error` field is bounded to
`{ name, message, stack? }`. Do not put the request body in there.

## Event levels

`logClientEvent` accepts a `level` of `debug | info | warn | error`.
The minimum level shipped to the buffer is controlled by
`VITE_LOG_LEVEL` (default `warn`). Lower-level events are dropped
client-side to keep buffer size bounded.

## Reading this from tests

`apps/web/src/__tests__/performance.spec.ts` and other test files
mock the `client-logger` module. The mock must preserve the public
`logClientEvent` shape so call-sites type-check.

## Examples

```ts
import { logClientEvent } from '@web/lib/client-logger';

logClientEvent({
  level: 'warn',
  event: 'reader-search-section-error',
  traceId: 'reader-search',
  error: { name: 'TypeError', message: 'item.load is not a function' },
});
```

The `traceId` should match an existing request trace (e.g. a
`createTraceId()` value) so logs can be correlated server-side if
the endpoint is a worker route.

## Cross-references

- ADR-092 — `plans/092-adr-token-storage-and-feature-gap-policy.md`
  (D3: telemetry external-by-default)
- `apps/web/src/lib/client-logger.ts` — implementation
- `apps/web/public/_headers` — `connect-src` must allow the
  chosen endpoint (or omit and let the browser block — by design)
- `docs/security-posture.md` — info-classification rules that
  apply to telemetry payloads
