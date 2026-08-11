# GOAP 226: Verify-Driven Gap Closure — Remaining Implementable Audit Items

**Date:** 2026-08-11
**Status:** In PR (one PR, atomic commits per slice)
**Baseline:** `main` @ `2bbcbf4` (post GOAP-225)
**Method:** 3-scout parallel verification of plans 212/214/215/221–224 against
source (status lines treated as untrusted per GOAP-225), then a 6-slice
implementation swarm on disjoint file sets.
**Related:** Plans 212, 214, 215, 216, 221, 223, 224; ADR-212, ADR-214, ADR-216, ADR-218

## 1. Analysis

A verification swarm re-checked every acceptance criterion of the completed
plans against `main`. Most claims verified truthful; the following were
genuinely missing or stale:

| ID | Verdict | Evidence |
| --- | --- | --- |
| 212-P4 | GAP | `apps/worker/src/routes/admin/grants.ts` GET /books/:id/grants had no LIMIT/OFFSET (unbounded scan); siblings use LIMIT 1000 |
| 212-P8 | GAP | `apps/worker/src/routes/export.ts` ran three independent bounded queries serially |
| 212-O3 | GAP | `TelemetryPayloadSchema` stripped the client logger's `dropped` counter (default-strip), so drop pressure was unobservable server-side |
| 212-O6 | GAP | `apps/web/src/sw.ts` had no SW-safe redacted logger, no global error/unhandledrejection handlers; sync failures were logged then swallowed |
| 212-F1 | GAP (deferred) | Reading insights had no chapter identity / chapter duration / reading speed — only minutes/pages/streak/ETA; docs did not overclaim |
| 214-R3 | GAP | Email send/fallback logs minted fresh trace ids — never inherited the initiating request trace |
| 214-R8 | GAP (partial) | Repeated-placeholder + Intl date/number helpers existed; no `Intl.PluralRules` pluralization helper |
| 214-R11 | GAP | `apps/worker/src/__tests__/routes.admin.test.ts` = 751 lines (only >500-line test file; plan 216 AC stale) |
| Docs | STALE | `docs/offline.md` claimed server mutationId idempotency (server never reads mutationId; dedup = UPSERT/MAX-merge) and listed `epub-files` CacheFirst (actual: `book-content` StaleWhileRevalidate + RangeRequests, `api-responses` 1h not 15min); `docs/reading-insights.md` listed shipped admin aggregation under Future Work; `docs/accessibility.md` said RTL regression "tracked under R9" though implemented |
| Plans | STALE | Plan 212 status omitted the remaining-wave closure; plan 216 "[x] no test file >500 lines" was false at verify time; plan 223 documented worker coverage 55/50 vs enforced 65/60 |

## 2. Implementation (this PR)

| Slice | Items | Files (key) |
| --- | --- | --- |
| A | P4 grants pagination + P8 export concurrency | `apps/worker/src/routes/admin/grants.ts`, `routes/export.ts`, `routes.admin.grants-pagination.test.ts`, `routes.export.test.ts` |
| B | O3 dropped counter + R3 email trace context | `packages/schema/src/schemas.ts` (`GrantsListQuerySchema`, `TelemetryPayloadSchema.dropped`), `routes/telemetry.ts`, `lib/email-transport.ts`, `routes/access.ts`, `routes/admin/auth.ts` |
| C | O6 SW observability | `apps/web/src/sw-logger.ts` (new), `apps/web/src/sw.ts`, `sw-observability.test.ts` |
| D | R8 `pluralize` (Intl.PluralRules) | `apps/web/src/lib/i18n-format.ts`, `i18n-formatting.test.ts` |
| E | R11 test split | `routes.admin.test.ts` (751→479), `routes.admin.insights.test.ts` (new) |
| F | F1 chapter duration + reading speed (local-only) | `offline/db.ts`, `offline/reading-insights.ts`, `useReadingTimer.ts`, `useReaderEpub.ts` (setChapter wiring), `InsightsSection.tsx`, all 13 locale catalogs, `docs/reading-insights.md` |
| Split | useReaderEpub.ts 538→≤500 lines (source LOC policy) | `useReaderEpub.helpers.ts` (new) |
| Docs | README D1/Turso wording, offline.md sync/cache claims, reading-insights.md Future Work, accessibility.md RTL | `README.md`, `docs/*.md` |

Design decisions:
- **Grants bound = 1000** (not the library 50/100): the admin grants view is not
  paginated, so a 50/100 cap would silently truncate realistic books; LIMIT 1000
  matches the comments/bookmarks/highlights convention from the same P4 finding
  while still bounding the scan. Documented in `GrantsListQuerySchema`.
- **F1 units**: chapter duration = cumulative active minutes on that chapter;
  reading speed = book-level words-per-minute estimate (total tracked words /
  total active minutes × 60). Chapter identity + word counts stay local-only
  (`chapterMinutes`/`chapterWords` never sync; ADR-102b privacy preserved).
- **O6**: redacted logger is a pure module (`sw-logger.ts`) testable under
  Vitest; sync failures log first then rethrow (rejects the `waitUntil` promise
  so Workbox/background-sync retries); global `error`/`unhandledrejection`
  handlers emit redacted JSON; trace propagation reads `traceparent`/`x-trace-id`
  from the initiating Request when in scope.

## 3. Out of Scope (unchanged)

- R1/R12/N3 email gate, S1–S9, O2, P5, P7 — private security triage (ADR-212/214)
- ADR-199 i18n plural-rule catalogs (deferral stands; the helper is now available)
- ADR-217 OTel decision (evaluation ADR stands)

## 4. Acceptance Criteria

- [x] Grants list endpoint bounded (LIMIT/OFFSET) with documented schema; export queries concurrent with bounds preserved
- [x] Client telemetry drop pressure observable server-side (optional `dropped` int, fail-open)
- [x] SW emits redacted logs for sync/lifecycle/global errors; retryable sync failures surface; no secrets in log output
- [x] Email send/fallback logs inherit the request trace when a request context exists
- [x] `pluralize` helper on `Intl.PluralRules` exported + unit-tested (en/ar/fr/ru/zh categories)
- [x] No first-party test file >500 lines; `useReaderEpub.ts` ≤500 lines
- [x] Reading insights record chapter identity + display chapter duration and reading speed (local-only); docs updated
- [x] Stale doc/plan lines corrected (offline.md, reading-insights.md, accessibility.md, README, plans 212/216/223)
- [x] `./scripts/quality_gate.sh` passes; PR CI green on GitHub
