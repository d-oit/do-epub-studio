# GOAP 102: Missing Tasks and New Feature Analysis - Reading Insights

**Date:** 2026-06-19
**Status:** CLOSED (plans-only, no code changes needed)
**Branch:** `docs-goap-missing-feature-tasks`
**Companion ADR:** `plans/102-adr-reading-insights-privacy-boundaries.md`
**Methodology:** GOAP (analyze -> decompose -> strategize -> coordinate -> execute -> synthesize)

## Goal

Identify current missing tasks after the recent gap-closure swarm and define
one new feature backlog item that is still absent from the shipped product:
privacy-preserving reading insights.

This plan does not change production code. It records the work needed for a
future implementation PR.

## Baseline

Repository state checked on 2026-06-19:

| Signal | Result |
|---|---|
| Main sync | `git fetch origin main` and `git merge origin/main` completed; already up to date |
| Current branch | `docs-goap-missing-feature-tasks` |
| Open GitHub issues | 0 |
| Open GitHub PRs | 1 (`#609`, adds `plans/101-e2e-performance-improvements.md`) |
| Scope of this change | `plans/` only |

## Stale Missing Tasks Re-checked

Several gaps from earlier plans are now closed and should not be reopened:

| Earlier gap | Current evidence | Status |
|---|---|---|
| In-book search | `apps/web/src/features/reader/components/search/SearchPanel.tsx` and `useReaderSearch.ts` exist; `ReaderPage.tsx` mounts the search panel | Closed |
| Reader offline status | `ReaderToolbar.tsx:57-60` reads `isOffline` and `pendingSyncCount`; `ReaderToolbar.tsx:130-136` renders offline status | Closed |
| App-wide offline banner | `App.tsx` mounts `OfflineIndicator`; `OfflineIndicator.tsx` listens to `online` and `offline` events | Closed |
| Pending sync count display | `ReaderPage.tsx:212-223` polls `getSyncQueue()` and calls `setPendingSyncCount`; toolbar renders the count | Closed |
| Client session refresh | `useSessionExpiry.ts` calls the refresh route and updates `sessionExpiresAt` | Closed |

## Verified Missing Feature

### Reading insights / reading statistics

The product has strong progress persistence but no reading insights model.

Evidence:

- `apps/web/src/features/reader/hooks/useEpubProgress.ts:20-72` saves only
  the latest CFI, percentage, and `lastRead` timestamp.
- `apps/worker/src/routes/reader/progress.ts:22-90` exposes only
  `locator`, `progressPercent`, and `updatedAt`.
- `docs/coding-guide.md:315-327` documents `reading_progress` with only
  `locator_json`, `progress_percent`, and `updated_at`.
- `ReaderToolbar.tsx:57-129` renders a percentage progress bar, not time
  spent, pages read, estimated remaining time, streaks, or per-book activity.
- `InfoPanel.tsx:103-224` shows book details and accessibility metadata, not
  reading insights.
- `rg` finds no production model for `timeSpent`, `pagesRead`,
  `readingStat`, or equivalent reading-insight fields.

This aligns with prior backlog references:

- `plans/088-goap-missing-implementation-analysis-2026-06-12.md` listed
  reading statistics as a P3 future enhancement.
- `plans/082-goap-modern-ui-design-overhaul-2026-06-11.md` mentioned
  reading statistics as a future UI item.

## Feature Definition

Build a reader-facing "Reading Insights" feature that answers a small set of
useful questions without introducing surveillance-style analytics:

| Insight | Source | Notes |
|---|---|---|
| Current session active reading time | Client clock, page visibility, reader focus | Pause while hidden, blurred, idle, or loading |
| Total active time for this book | Local IndexedDB first, optional server aggregate | Round to minutes before sync |
| Estimated time remaining | Recent active time plus progress delta | Display only when confidence is sufficient |
| Reading streak | Local daily buckets | Optional; no public/social sharing |
| Recent activity | Per-book local summary | Do not include raw CFI or selected text |

Non-goals:

- No third-party analytics integration.
- No raw reading-location telemetry.
- No admin view of individual reader behavior.
- No engagement scoring, ranking, or automated access decisions.

## Decomposition

| ID | Task | Priority | Dependencies | Skill |
|---|---|---:|---|---|
| T1 | Adopt ADR-102 privacy boundaries before implementation | P0 | none | privacy-first |
| T2 | Design local reading-insights store and daily bucket shape | P1 | T1 | pwa-offline-sync |
| T3 | Add shared DTO/Zod contracts for insight summaries | P1 | T1 | testdata-builders |
| T4 | Add Worker route for optional coarse insight sync | P1 | T2, T3 | cloudflare-worker-api |
| T5 | Add Turso migration for coarse per-book insight aggregates | P1 | T2, T3 | turso-schema-migrations |
| T6 | Track active reading time in the reader | P1 | T2 | reader-ui-ux |
| T7 | Surface insights in reader UI | P1 | T6 | reader-ui-ux |
| T8 | Add unit, integration, and Playwright coverage | P1 | T3-T7 | testing-strategy |
| T9 | Add documentation and runbook notes | P2 | T4-T8 | code-quality |

## Strategy

Use a sequential foundation followed by parallel implementation:

1. **Foundation:** ADR-102, DTO shape, local store design.
2. **Parallel build:** Worker/schema route work and reader UI tracking can
   proceed independently after the DTO contract is fixed.
3. **Integration:** Sync local buckets, render summaries, and add Playwright
   coverage for pause/resume behavior.
4. **Validation:** Run full quality gate and targeted tests.

## Acceptance Criteria

- Reading time only increments while the reader is visible, focused, loaded,
  and not idle.
- Metrics are rounded before any server sync.
- No raw CFI, chapter title, selected text, session token, or email is sent to
  telemetry or new insight endpoints.
- Offline reading updates local insight buckets and syncs later.
- Reader UI uses semantic design tokens from `globals.css`.
- All critical insight save/sync failures emit trace-aware client events
  without sensitive metadata.
- Tests cover visible/focused timing, hidden-tab pause, offline queueing, sync
  conflict behavior, i18n keys, and accessibility of the insight UI.

## Quality Gates

- `./scripts/quality_gate.sh`
- Targeted web unit tests for timer state and reader UI.
- Worker route tests for authorization, validation, and tenant isolation.
- Offline sync tests for local-first bucket merge behavior.
- Playwright smoke test for the reader insight panel.

## Synthesis

The current codebase has closed the previously listed search and offline UI
gaps. The remaining user-facing feature opportunity is not more plumbing; it is
a carefully scoped reading-insights feature. ADR-102 must govern the work so
the implementation improves reader usefulness without adding invasive analytics.
