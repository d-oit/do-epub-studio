# GOAP-299: Logging privacy + correlation hardening — A6/A7 corrective slice

**Status:** DONE
**Date:** 2026-09-30
**Type:** Corrective implementation slice (authorized from the GOAP-298 audit)
**ADRs referenced:** ADR-214 (audit recommendation governance), ADR-246
(do-harness completion contract)
**Source findings:** A6 (redaction destroys request-log correlation) and A7
(client telemetry has no privacy scrub boundary) in
`analysis/comprehensive-gap-audit.md` (GOAP-298)

## Goal

Fix the two P1 logging/privacy-control findings with their published
acceptance criteria: preserve validated structural correlation ids at log
boundaries, and sanitize client log entries before every sink — without
weakening general secret redaction.

## Changes

- **New canonical sanitizer** `packages/shared/src/redact.ts` (moved from
  `apps/worker/src/lib/redact.ts`, which is deleted): `scrub`,
  `isSensitiveKey`, and the new `scrubLogEntry`. Sensitive-key definitions are
  normalized at definition time (lowercased, `[-_]` stripped), so the
  hyphenated `set-cookie` entry can no longer be missed
  (`isSensitiveKey('Set-Cookie')` was false before; true now).
- **A6 correlation contract:** `scrubLogEntry` preserves only the closed set
  `traceId`, `spanId`, `clientTraceId`, `clientSpanId`, `ingestTraceId`,
  `ingestSpanId` — at record level and inside one structural `metadata` level —
  when the value is a bounded (`≤64`), identifier-shaped (`[A-Za-z0-9-]+`)
  string. Everything else (arbitrary metadata, error text, nested payloads)
  is still scrubbed, including identifier-shaped secrets under any other key,
  and an oversized/invalid correlation value falls back to `scrub`.
- **Worker cutover:** `apps/worker/src/lib/observability.ts` `log()` now uses
  `scrubLogEntry`; `apps/worker/src/routes/telemetry.ts` imports `scrub` from
  `@do-epub-studio/shared` (persistence columns keep plain `scrub`).
- **Client cutover (A7):** `apps/web/src/lib/client-logger.ts` sanitizes each
  entry once with `scrubLogEntry` before the console, the in-memory buffer and
  the `VITE_TELEMETRY_ENDPOINT` payload. The service-worker logger
  (`apps/web/src/sw-logger.ts`) already has its own SW-boundary redaction and
  was intentionally left unchanged (different semantics; not an A7 anchor).
- **Tests:** `apps/worker/src/__tests__/observability.test.ts` — the old
  expectation that pinned erased correlation (and passed short ids to bypass
  the scrubber) is replaced by: real-format ids visible for context/minted
  logs, request/error log ids equal to the response trace headers, and
  secret/identifier-shaped redaction intact. `apps/worker/src/lib/__tests__/`
  removed; the redaction suite moved to `packages/shared/src/__tests__/
redact.test.ts` and extended (`Set-Cookie` detection, correlation
  preservation at record and metadata level, oversized-correlation fallback,
  sensitive keys at the record level — the last one caught a real bug during
  this slice). `apps/web/src/__tests__/client-logger.test.ts` gained a
  fake-timer sink test asserting console + flushed endpoint payloads keep the
  trace id and redact synthetic secrets.
- **Docs:** `docs/observability-telemetry.md` §"What NOT to send" now states
  the client-boundary enforcement and the preserved correlation contract.

## Acceptance evidence

- `pnpm --filter @do-epub-studio/shared test:unit` → 151/151 pass.
- `pnpm --filter @do-epub-studio/worker test:unit` → 528/528 pass.
- `pnpm --filter @do-epub-studio/web test:unit` → 1433/1433 pass.
- `typecheck` clean for shared, worker and web; `eslint --max-warnings 0`
  clean for all three packages.
- Real-function probe (Bun, actual modules, synthetic values only):
  `isSensitiveKey('Set-Cookie')` → true; `createRequestContext` +
  `withTraceHeaders` → request start/error log `traceId`/`spanId` equal the
  response headers with a real-format UUID; synthetic `password`,
  `reader@example.test` email and 40-char identifier-shaped note redacted;
  client `logClientEvent` console line keeps the UUID trace id and redacts
  `password`/`email`/`Set-Cookie` to `[REDACTED]`.
- Limits: unit/function-level only — no deployed Worker tail, no external
  collector transmission, no live traffic. A6's response-header equality is
  proven at the module boundary; A7's endpoint path is proven via the
  sendBeacon payload, not a real collector.

## Design notes

- The correlation exception is deliberately a closed allowlist plus a value
  shape check, so it cannot be abused by arbitrary metadata keys, and it does
  not remove any existing redaction pattern.
- No dependency, configuration, security-policy or other product surface was
  changed. A8 (retention) and the remaining findings stay open per GOAP-298.
