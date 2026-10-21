import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type ReactNode } from 'react';
import type { ReadingInsightEntry } from '../../../../lib/offline/db';
import { useAuthStore } from '../../../../stores/auth';
import { InfoPanel } from './InfoPanel';

/**
 * F9 (GOAP-290) / GOAP-296: real insights proof. Seeds the device-local
 * insights store at its storage boundary (the IndexedDB module owns encryption
 * and is mocked — its own tests cover the codec) and asserts the actual
 * metrics the panel computes and renders through the real
 * `computeInsightSummary`. The former E2E check asserted `visible || true` and
 * could never fail.
 *
 * N3 (GOAP-1004 / GOAP-1009 F09): the export proof runs against the same real
 * pipeline, so the exported payload is the summary the panel actually computed —
 * never a hand-written fixture. The network boundary is observed at `fetch`,
 * the real transport the API client uses, so a request made by the export
 * itself cannot hide behind a mocked `apiRequest`.
 */

const dbStub = vi.hoisted(() => ({ entries: [] as ReadingInsightEntry[], fail: false }));

vi.mock('../../../../lib/offline/db', () => ({
  getReadingInsightsForBook: vi.fn((bookId: string) => {
    if (dbStub.fail) return Promise.reject(new Error('IndexedDB read failed'));
    return Promise.resolve(dbStub.entries.filter((entry) => entry.bookId === bookId));
  }),
  getReadingInsight: vi.fn(() => Promise.resolve(undefined)),
  saveReadingInsight: vi.fn(() => Promise.resolve()),
}));

import { getReadingInsightsForBook } from '../../../../lib/offline/db';

vi.mock('@do-epub-studio/ui', () => ({
  useFocusTrap: vi.fn(),
  IconButton: ({
    children,
    onClick,
    'aria-label': ariaLabel,
  }: {
    children: ReactNode;
    onClick: () => void;
    'aria-label': string;
  }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  metadata: { title: 'Test Book' },
  bookId: 'book-1',
  progressPercent: 50,
  t: (key: string) => key,
};

describe('InfoPanel insights (real summary pipeline)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    dbStub.entries = [];
    dbStub.fail = false;
    // Reset before rendering: `afterEach` hooks run before the suite's
    // `cleanup()`, so resetting the store there would update a still-mounted
    // panel outside `act`.
    useAuthStore.setState({ sessionToken: null });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders metrics computed from the seeded insights store for this book', async () => {
    dbStub.entries = [
      { bookId: 'book-1', date: '2026-07-01', activeMinutes: 10, activePages: 5, lastUpdated: 1 },
      { bookId: 'book-1', date: '2026-07-02', activeMinutes: 15, activePages: 7, lastUpdated: 2 },
      // Another book must not leak into these totals.
      { bookId: 'book-2', date: '2026-07-02', activeMinutes: 99, activePages: 99, lastUpdated: 3 },
    ];

    render(<InfoPanel {...baseProps} />);

    // The local section heading carries the device-local suffix (N1).
    const heading = await screen.findByText(/reader\.readingInsights/);
    const insights = heading.closest('section');
    expect(insights).not.toBeNull();
    if (!insights) throw new Error('insights section missing');
    const totalTimeRow = within(insights).getByText('reader.totalActiveTime').closest('div');
    const pagesRow = within(insights).getByText('reader.pagesRead').closest('div');
    expect(totalTimeRow).not.toBeNull();
    expect(pagesRow).not.toBeNull();
    if (!totalTimeRow || !pagesRow) throw new Error('insight rows missing');
    expect(within(totalTimeRow).getByText('25 min')).toBeInTheDocument();
    expect(within(pagesRow).getByText('12')).toBeInTheDocument();
    expect(getReadingInsightsForBook).toHaveBeenCalledWith('book-1');
  });

  // N1: the panel no longer hides the section when the device store is empty —
  // it states the absence honestly while keeping the local/synced split visible.
  it('shows the labelled local empty state when the store holds no activity', async () => {
    render(<InfoPanel {...baseProps} />);

    await waitFor(() => {
      expect(getReadingInsightsForBook).toHaveBeenCalledWith('book-1');
    });
    expect(screen.getByText('reader.noLocalActivity')).toBeInTheDocument();
    expect(screen.getByText('reader.syncedHistory')).toBeInTheDocument();
    expect(screen.queryByText('reader.pagesRead')).not.toBeInTheDocument();
  });

  // A storage failure is NOT "no reading activity": the store could not be read,
  // so claiming an empty history would be a false statement.
  it('reports unavailable device storage instead of claiming no local activity', async () => {
    dbStub.fail = true;

    render(<InfoPanel {...baseProps} />);

    expect(await screen.findByText('reader.localInsightsUnavailable')).toBeInTheDocument();
    expect(screen.queryByText('reader.noLocalActivity')).not.toBeInTheDocument();
    // Nothing may be exported from a store that could not be read.
    expect(screen.getByRole('button', { name: 'reader.exportInsights' })).toBeDisabled();
  });

  // N1 (GOAP-1009 F07): a failing synced request must not take the populated
  // device-local metrics down with it.
  it('keeps the seeded local metrics visible when the synced request fails', async () => {
    dbStub.entries = [
      { bookId: 'book-1', date: '2026-07-01', activeMinutes: 25, activePages: 12, lastUpdated: 1 },
    ];
    useAuthStore.setState({ sessionToken: 'tok-synced-failure' });
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network unavailable'));

    render(<InfoPanel {...baseProps} />);

    const heading = await screen.findByText(/reader\.readingInsights/);
    const localSection = heading.closest('section');
    if (!localSection) throw new Error('insights section missing');
    const totalTimeRow = within(localSection).getByText('reader.totalActiveTime').closest('div');
    if (!totalTimeRow) throw new Error('total active time row missing');
    expect(within(totalTimeRow).getByText('25 min')).toBeInTheDocument();

    // The synced section reports the failure — it does not fall back to a
    // "no synced history" claim, and it never erases the local values.
    // A network failure is retried with backoff by the API client, so the
    // unavailable state only appears once the client gives up. The wait is
    // wrapped in `act` because the retry timers settle the promise outside
    // React's event scope.
    expect(await screen.findByText('reader.syncedUnavailable')).toBeInTheDocument();
    expect(screen.queryByText('reader.noSyncedHistory')).not.toBeInTheDocument();
    expect(within(totalTimeRow).getByText('25 min')).toBeInTheDocument();
  });

  // N3 (GOAP-1009 F09): the export is proved against the real summary pipeline
  // and the real network boundary.
  it('exports the selected book only, from the real pipeline, without a network request', async () => {
    dbStub.entries = [
      { bookId: 'book-1', date: '2026-07-01', activeMinutes: 25, activePages: 12, lastUpdated: 1 },
      // Another book must not leak into the exported payload.
      { bookId: 'book-2', date: '2026-07-01', activeMinutes: 99, activePages: 99, lastUpdated: 2 },
    ];
    useAuthStore.setState({ sessionToken: 'tok-offline-export' });
    // The network is unavailable: the synced request fails and settles before
    // the export is triggered.
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network unavailable'));
    globalThis.fetch = fetchMock;

    const capture: { blob: Blob | null } = { blob: null };
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      capture.blob = blob as Blob;
      return 'blob:mock-insights';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<InfoPanel {...baseProps} />);

    // Wait for the synced request to settle as failed. The API client retries
    // network failures with backoff, so the unavailable state arrives late.
    await screen.findByText('reader.syncedUnavailable');
    const requestsBeforeExport = fetchMock.mock.calls.length;
    expect(requestsBeforeExport).toBeGreaterThan(0);

    const exportButton = screen.getByRole('button', { name: 'reader.exportInsights' });
    expect(exportButton).toBeEnabled();
    fireEvent.click(exportButton);

    // The export is device-local: it must not issue another request.
    expect(fetchMock.mock.calls.length).toBe(requestsBeforeExport);

    expect(capture.blob).not.toBeNull();
    if (!capture.blob) throw new Error('export did not create a Blob');
    const text = await capture.blob.text();
    const parsed = JSON.parse(text) as {
      bookId: string;
      exportedAt: string;
      insights: Record<string, unknown>;
    };

    // Selected book only: the other book's 99 minutes / 99 pages are absent.
    expect(parsed.bookId).toBe('book-1');
    expect(parsed.insights.totalActiveMinutes).toBe(25);
    expect(parsed.insights.totalActivePages).toBe(12);
    // ETA from the real computation: 25 minutes at 50% progress → 25 remaining.
    expect(parsed.insights.estimatedMinutesRemaining).toBe(25);
    expect(text).not.toContain('book-2');

    // Local metrics only — no synced section, no credentials, no URL.
    expect(Object.keys(parsed).sort()).toEqual(['bookId', 'exportedAt', 'insights']);
    expect(Object.keys(parsed.insights).sort()).toEqual([
      'chapterDurations',
      'currentStreakDays',
      'estimatedMinutesRemaining',
      'readingSpeedWpm',
      'recentActivity',
      'totalActiveMinutes',
      'totalActivePages',
    ]);
    expect(text).not.toMatch(/token|email|@|https?:/i);
  });
});
