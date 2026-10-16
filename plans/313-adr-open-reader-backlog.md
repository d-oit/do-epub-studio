# ADR-313: Durable offline annotations, revision-aware anchors, and offline search

**Date:** 2026-10-14
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** GOAP-1007, TRIZ analysis `analysis/triz-core-2026-10-14.md`, issues #1323–#1329, CI issue #1330, existing offline/idempotency ADRs 005/006/302, ADR-312.

## Context

The open reader backlog spans concurrent offline mutations, annotation anchors across EPUB revisions, background indexing/search, modular EPUB lifecycles, and an unreliable scheduled E2E environment. These paths share data and lifecycle contracts: annotations are encrypted locally, comments are tenant-scoped, EPUB files can have several `book_files` records, and comment creation already uses server-side mutation-ID deduplication. A fix that treats each symptom independently risks duplicate writes, lost offline content, silently wrong anchors, stale indexes, or green but vacuous CI.

## Decision

1. **Retry delivery is at-least-once; mutation effects are idempotent.** Each queued logical mutation keeps a stable client-generated ID across retries and reloads. The server deduplicates that ID at the durable write boundary. Use `navigator.locks` when available and a single-flight fallback otherwise. Retry network errors, 429, and 5xx with bounded exponential backoff and jitter. Classify permanent 4xx failures without stopping later queue entries; preserve failed payloads until a user explicitly retries, exports, or resolves them.
2. **Concurrent edits carry an explicit base version.** A request that targets a changed server revision returns a conflict, not a silent overwrite. Preserve both local and canonical server content with the existing conflict-resolution conventions. Authorization and tenant validation precede any conflict details.
3. **EPUB revisions are immutable, content-identified inputs to annotation/index state.** The revision metadata is idempotent for repeated completion of the same uploaded content. Every migrated annotation records the source and target revision, old locator snapshot, confidence, and outcome. Migration work is bounded/resumable; exact CFI and position precede quote/context matching. Ambiguous or deleted text remains accessible as needs-review/orphaned, with original quote and locator intact.
4. **Search is a revision-bound Worker computation with encrypted persistence.** Build/query chapter token data off the UI thread, persist it under the existing IndexedDB privacy/encryption contract, and invalidate it when the book/revision is removed or access is revoked. Return only the fields required for snippets and CFI navigation. No remote search fallback is required for cached books.
5. **Exports are explicit, authorized formats over a documented annotation profile.** Markdown groups by chapter and includes quotes, anchors, timestamps, thread/reviewer and resolution state. JSON-LD uses the W3C Web Annotation Data Model with a documented profile. CSV/JSON filters are schema-validated and use real reviewer/tag/status fields; exports stay tenant/user scoped and escape all user-controlled output.
6. **Reader hooks own separate lifecycle responsibilities without duplicating the rendition.** `useReaderEpub` remains a thin composition facade. High-frequency location state uses the current state-management approach unless before/after render measurements show a scoped context/store improvement. Theme/font changes update the live rendition without reloading the archive or losing its CFI.
7. **Tests own their backend dependencies.** E2E tests either mock the exact endpoints they exercise, including safe defaults for background API reads, or start a local Worker with local-only D1. They do not depend on an absent `localhost:8787`, suppress network failures, loosen assertions, or use sleeps as state synchronization. E2E-only diffs trigger smoke coverage.
8. **Merge policy remains fail-closed.** Fix PR #1322's title/commit-range metadata and merge it before the re-anchor refactor. Merge PR #1331 after implementation, when its multi-context tests execute and all required checks pass. No admin/auto-merge bypass or unresolved review threads.

## Alternatives considered

- **Claim transport-level exactly-once delivery.** Rejected: a client cannot know whether a response was lost after the server committed. Stable IDs and server dedupe make repeated delivery idempotent.
- **Delete a mutation after a fixed retry count.** Rejected: that converts transient failure into silent data loss and contradicts non-destructive recovery.
- **Automatically choose the nearest fuzzy anchor.** Rejected: approximate matches can attach comments to the wrong passage. Preserve the old anchor and require review below the confidence threshold.
- **Persist a plaintext search index or query the network when offline.** Rejected: the first leaks cached book text outside the existing local privacy contract; the second cannot satisfy offline behavior.
- **Put reader location in a new global store immediately.** Rejected: no render measurements justify widening state coupling; focused hooks can compose the existing store first.
- **Start a remote/production D1 for E2E or suppress unmocked failures.** Rejected: it makes tests non-isolated and can hide setup defects. Use local-only Worker/D1 or complete deterministic fixture ownership.
- **Merge the re-anchor PR after implementation.** Rejected: its source diff would overlap the refactor; merge first so the performance change is the baseline for modularization.

## Consequences

### Positive

- Offline retries survive reloads and multiple tabs without duplicate server effects or silent payload deletion.
- Conflicts and uncertain anchors preserve both the user's work and source revision metadata.
- Search is usable offline without moving large chapter scans onto the UI thread or dropping existing at-rest encryption.
- The resulting E2E pass proves the changed behavior instead of passing due to skipped tests or a suppressed network error.

### Negative

- Schema/API changes and migration state require backward-compatible deployment ordering and thorough tests.
- Encrypting and transferring a persisted index has some CPU/storage cost; the benchmark and lifecycle tests determine the acceptable index shape.
- A needs-review outcome requires editorial attention rather than automatic cleanup; this is intentional when confidence is low.
- A local Worker E2E lane adds process setup if endpoint mocking cannot isolate a scenario.

## Compliance and review triggers

- Keep all existing auth, tenant, revocation, and encrypted-store invariants; add tests at those boundaries.
- Use the current Cloudflare Workers/D1 and Playwright official docs cited in `analysis/triz-core-2026-10-14.md`.
- Review the search index representation if measured p95 query time exceeds 100 ms on the documented 300-page corpus or if bundle/storage cost is unacceptable.
- Review re-anchor strategy if the documented 100-annotation/50-KB benchmark misses the 50-ms target; report the actual baseline and do not suppress the benchmark.
- Revisit `navigator.locks` fallback only if supported browsers lack a safe cross-tab coordination primitive; retain server idempotency regardless.
