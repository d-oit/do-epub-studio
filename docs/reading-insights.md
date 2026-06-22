# Reading Insights

> **Status:** Implemented
> **Date:** 2026-06-19
> **Related:** `plans/102-goap-missing-tasks-reading-insights-2026-06-19.md`,
> `plans/102-adr-reading-insights-privacy-boundaries.md`

## Overview

Reading Insights provides readers with a small set of useful, privacy-preserving
metrics about their reading activity. The feature is intentionally narrow and
follows the privacy boundaries defined in ADR-102.

## What Is Tracked

| Insight | Source | Notes |
|---|---|---|
| Total active reading time | Client timer | Pauses while hidden, blurred, or idle |
| Estimated time remaining | Active time + progress | Shown only when confidence is sufficient |
| Current reading streak | Local daily buckets | Consecutive days with reading activity |
| Recent activity | Per-book local summary | Last 7 days of activity |

## Privacy Boundaries

Per ADR-102, reading insights are:

- **Local-first** — counters are computed and stored locally before any sync
- **Active time only** — hidden tabs, background windows, and idle periods do not count
- **Coarse granularity** — any server-bound duration is rounded to whole minutes
- **No raw reading locations** — no CFI, selected text, chapter titles, or snippets
- **No third-party analytics** — all data stays in d.o.EPUB Studio
- **Admin aggregation only** — no individual reader behavior timelines

## Architecture

### Client-Side

- `apps/web/src/lib/offline/reading-insights.ts` — `ReadingTimer` class and `computeInsightSummary` function
- `apps/web/src/features/reader/hooks/useReadingTimer.ts` — React hook that wires the timer into the reader
- `apps/web/src/features/reader/components/info/InfoPanel.tsx` — Displays insights in the reader info panel

The timer tracks visibility (`visibilitychange`), focus (`focus`/`blur`), and
idle state (5-minute timeout). Time is only accumulated when the reader is
visible, focused, loaded, and not idle.

### Storage

- **Local:** IndexedDB store `readingInsights` keyed by `[bookId, date]`
- **Server:** Turso table `reading_insights` with daily buckets per book/reader

### Server-Side

- `apps/worker/src/routes/reader/insights.ts` — Worker route for insight sync
- `packages/schema/migrations/0004-reading-insights.sql` — Database migration

The sync endpoint accepts coarse daily buckets and uses `MAX()` to merge
conflicting values (first-write wins for higher values, prevents data loss).

## Data Model

### Local (IndexedDB)

```typescript
interface ReadingInsightEntry {
  bookId: string;
  date: string; // YYYY-MM-DD
  activeMinutes: number;
  lastUpdated: number;
}
```

### Server (Turso)

```sql
CREATE TABLE reading_insights (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  bucket_date TEXT NOT NULL,
  active_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  UNIQUE(book_id, user_email, bucket_date)
);
```

## API

### `POST /api/books/:bookId/insights/sync`

Syncs local reading insight buckets to the server.

**Request body:**
```json
{
  "bookId": "uuid",
  "buckets": [
    { "date": "2026-06-19", "activeMinutes": 15 }
  ]
}
```

**Response:** `{ "ok": true }` on success

### `GET /api/books/:bookId/insights`

Retrieves the user's reading insights for a book.

**Response:**
```json
{
  "ok": true,
  "data": {
    "totalActiveMinutes": 120,
    "currentStreakDays": 3,
    "recentActivity": [
      { "date": "2026-06-19", "activeMinutes": 15 }
    ]
  }
}
```

## Testing

- `apps/worker/src/__tests__/routes.insights.test.ts` — Worker route tests
- `apps/web/src/lib/offline/reading-insights.test.ts` — Client timer tests
- `apps/web/src/__tests__/info-panel.test.tsx` — InfoPanel integration tests

## Future Work

- Admin aggregation views (per-book or per-grant summaries)
- Reader-facing time-of-day insights
- Export insights as CSV/JSON
