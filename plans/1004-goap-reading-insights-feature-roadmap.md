# GOAP-1004: Reading insights feature roadmap

**Status:** DONE — N1/N2/N3 implemented 2026-10-05 (user-authorized)
**Date:** 2026-10-04
**Type:** Optional feature specifications (execution planning; implementation not
started)
**Source audit:** `plans/1000-goap-implementation-security-e2e-feature-audit.md`
— GOAP-1000, opportunities N1–N3
**Governance:** `plans/1000-adr-audit-evidence-and-scope.md` (ADR-1000)
**Related:** `docs/reading-insights.md`, GOAP-296 (insights proof),
GOAP-1002 (S1/S2 prerequisites), GOAP-298 (where N1/N2 were first recorded as
opportunities)

## Goal

Specify three optional reading-insights features precisely enough for execution
planning. These are opportunities formalized from existing backlog entries, not
missing requirements and not implementation defects: their absence from the
product's obligations is a recorded fact.

Scope discipline: no cloud AI provider, no manuscript history, no new analytics
schema and no notes-import persistence promise is introduced here.

## N1 — Synced reading history alongside device-local insights

Extend the existing reader Info panel, reusing
`apps/web/src/features/reader/components/info/InfoPanel.tsx:52–65`, the existing
`InsightsSection` and `GET /api/books/:bookId/insights`
(`apps/worker/src/routes/reader/insights.ts:26–67`).

- Local and synced sections are labelled separately and **never summed**.
- Synced totals cover at most the 30 stored daily buckets returned by the
  endpoint — they are not lifetime totals. Recent activity is the last seven
  returned buckets.
- ETA, chapter durations and reading speed remain device-local.
- An empty synchronized history has a meaningful empty state.
- A network failure leaves local metrics available with an explicit unavailable
  indication.
- 401 follows existing auth-loss handling; revoked access never silently
  continues.

Acceptance: with a fresh local store and a server summary of 120 minutes,
60 pages and a 3-day streak, the panel renders those synced values; a second
book never appears; a network failure leaves the populated local metrics intact.

This formalizes the existing optional cross-device insights opportunity recorded
in GOAP-298; it is not a new bug.

## N2 — Book-only aggregate insights on the admin dashboard

Reuse `GET /api/admin/insights`
(`apps/worker/src/routes/admin/insights.ts:32–65`) and the existing dashboard
section pattern. No new route and no migration.

- Display book, total active minutes, total pages, reader count and last
  activity.
- Consume the endpoint's current limit/offset pagination and use existing locale
  formatting.
- Never send or render individual reader identity or per-reader timelines.
- Empty and API-failure states are distinct; non-admin access stays denied.

Acceptance: two seeded books render their correct aggregates; the next page
contains a different fixture book set; the response and the UI contain no reader
email or timeline; a non-admin receives no aggregates.

This is an existing optional opportunity from GOAP-298, newly specified for
execution planning.

## N3 — Offline download of the selected book's local insight summary

Add an explicit, user-triggered export action to the existing Info panel, using
`computeInsightSummary(bookId, progressPercent)`
(`apps/web/src/lib/offline/reading-insights.ts:224–254`) and the existing
Blob/download idiom in `useExportNotes.ts:274–290`.

- Export that existing summary shape only, including nullable ETA/speed values
  as they are.
- No token, URL, email or additional manuscript text; no server telemetry
  request; no cross-book collection.
- Label the export device-local and expose the local-file privacy implication
  before the download.
- No activity disables the action with an intelligible empty state.
- A storage failure reports that no export happened rather than fabricating zero
  metrics.

Acceptance: a selected book at 25 minutes, 12 pages and 50% progress exports
parseable JSON containing those metrics and an estimated 25 minutes remaining; a
second book's 99-minute record is absent; an offline export succeeds with no
network request.

`docs/reading-insights.md:139–142` already lists export as future work, so this
promotes an opportunity rather than promising a missing feature.

## Sequencing

Corrective work first: S1/S2/S4 and M1/E1, then M2/M3/E2/E3/E4.

- N1 and N2 require the underlying persistence and identity controls plus their
  acceptance before implementation.
- N3 requires S1/S2 and its selected-book export check.
- S3 is policy/evidence collection, A8/A12 require deployment access, and AI-03
  requires a human reviewer.

None of these prerequisites prevents publishing this roadmap now.

## Non-actions

- No route, migration, analytics schema or AI provider is proposed.
- No implementation, test or UI change was made by this record.
- No historical unit or E2E pass is cited as fresh evidence for these features.

## Implementation 2026-10-05 (user-authorized: "read plans/ and implement all missing tasks")

**Status:** DONE — N1, N2, N3 implemented.

- **N1.** `InsightsSection` renders separately labelled device-local and synced
  sections that are never summed; `InfoPanel` fetches
  `GET /api/books/:bookId/insights` and shows loading, empty and unavailable
  states while leaving populated local metrics intact. The synced section shows
  totals over at most the 30 stored buckets and the last seven activity buckets;
  ETA, chapter durations and reading speed stay device-local. Verified by
  `apps/web/src/__tests__/info-panel.test.tsx` (120 min/60 pages/3-day
  fixture, no summed figure, exported JSON parsed) and the browser assertion in
  `apps/tests/reader-annotations-and-admin.spec.ts`. The panel renders the
  insights block outside the metadata branch (insights do not depend on book
  metadata) and validates the endpoint payload with Zod, degrading to the
  unavailable state on a malformed response. The former
  `InfoPanel.insights.test.tsx` was deleted upstream (`7e0cbd6c`); its
  local-empty-state expectation moved into that suite.
- **N2.** `AdminDashboardPage` consumes `GET /api/admin/insights` with
  limit/offset pagination and renders book/active-time/pages/readers/last-activity
  with locale date formatting; distinct loading, failure and empty states; no
  reader identity or timeline is sent or rendered. Verified by
  `apps/web/src/__tests__/admin-dashboard-page.test.tsx` (aggregates, next-page
  fixture set, empty state) and the existing worker aggregate/no-email tests.
- **N3.** The reader Info panel exposes an explicit device-local JSON export of
  the selected book's `computeInsightSummary` output (including nullable
  ETA/speed), with a privacy note and a disabled empty state. Verified by the
  export test in `apps/web/src/__tests__/info-panel.test.tsx` (parseable JSON,
  25 min/12 pages/25 min remaining, second book absent, no token/email/URL).
