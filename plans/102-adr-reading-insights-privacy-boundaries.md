# ADR-102: Reading Insights Privacy Boundaries

> **Status:** Accepted
> **Date:** 2026-06-19
> **Related:** `plans/102-goap-missing-tasks-reading-insights-2026-06-19.md`,
> `plans/archive/005-adr-offline-sync.md`,
> `plans/067-adr-observability-and-ci-resilience.md`,
> `plans/092-adr-token-storage-and-feature-gap-policy.md`
> **Tags:** privacy, reader, offline-sync, analytics

## Context

EPUB Studio persists reader progress and annotations, but it does not yet have
reading insights such as active reading time, estimated time remaining, or
reading streaks.

This feature can be useful, but it also creates privacy risk if implemented as
fine-grained behavioral analytics. The project already treats EPUB content,
locators, sessions, and auth state as sensitive surfaces. Any reading-insights
work must therefore be local-first, coarse, and tenant-scoped.

## Decision

1. **Local-first by default.** Reading insight counters are computed and stored
   locally first. Server sync is optional and only stores coarse aggregates.
2. **Active time only.** Time increments only when the reader is visible,
   focused, loaded, and not idle. Hidden tabs, background windows, loading
   states, and idle periods do not count.
3. **Coarse sync granularity.** Any server-bound duration is rounded to whole
   minutes and bucketed by day before sync.
4. **No raw reading locations.** Insight records must not store or transmit raw
   CFI values, selected text, chapter titles, snippets, or EPUB content.
5. **No direct identity in new insight tables.** New reading-insight tables must
   avoid direct email columns. They may reference existing scoped identifiers
   such as book ID, grant ID, or reader session ID when needed for authorization
   and tenant isolation.
6. **No third-party analytics.** Reading insights must not depend on external
   analytics vendors. Existing client logging may record coarse success/failure
   events only.
7. **Admin aggregation only.** If admin reporting is added later, it must show
   aggregate book-level or grant-level summaries. It must not expose individual
   reader behavior timelines.
8. **Trace-safe events.** Critical save/sync failures must emit trace-aware
   events per ADR-067, but event metadata must exclude session tokens, email,
   raw locators, chapter titles, and selected text.
9. **Offline merge behavior.** Offline buckets merge additively by bucket key.
   Progress position remains last-write-wins under ADR-005; insight counters
   are separate and must not affect locator conflict resolution.

## Consequences

### Positive

- The feature gives readers useful feedback without introducing invasive
  behavior tracking.
- Offline reading can contribute to insights without requiring constant network
  access.
- The data model stays compatible with existing tenant-isolation and traceId
  requirements.

### Negative

- Minute-level rounding and idle detection make insights approximate, not
  exact.
- Admin analytics remain intentionally limited unless a later ADR expands the
  policy.
- Implementation needs focused tests for timing, visibility, and offline merge
  behavior.

## Implementation Notes

- Prefer a small client state machine over scattered timers.
- Use `visibilitychange`, `focus`, `blur`, reader load state, and an idle
  timeout to determine active reading state.
- Store local buckets in IndexedDB next to existing offline state.
- Add Zod schemas in the shared/schema layer before Worker route work.
- Keep UI copy factual and non-judgmental.

## Compliance

- AGENTS.md Tier 1: traceId on critical UI actions and Worker requests.
- AGENTS.md Tier 1: no secrets, tokens, or credentials in telemetry.
- ADR-005: offline sync remains local-first with deterministic merge behavior.
- ADR-067: observability events are trace-aware but privacy-bounded.
- ADR-092: feature gaps and sensitive client behavior are documented before
  implementation.
