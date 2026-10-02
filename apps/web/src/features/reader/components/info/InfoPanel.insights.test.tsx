import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type ReactNode } from 'react';
import type { ReadingInsightEntry } from '../../../../lib/offline/db';
import { InfoPanel } from './InfoPanel';

/**
 * F9 (GOAP-290) / GOAP-296: real insights proof. Seeds the device-local
 * insights store at its storage boundary (the IndexedDB module owns encryption
 * and is mocked — its own tests cover the codec) and asserts the actual
 * metrics the panel computes and renders through the real
 * `computeInsightSummary`. The former E2E check asserted `visible || true` and
 * could never fail.
 */

const dbStub = vi.hoisted(() => ({ entries: [] as ReadingInsightEntry[] }));

vi.mock('../../../../lib/offline/db', () => ({
  getReadingInsightsForBook: vi.fn((bookId: string) =>
    Promise.resolve(dbStub.entries.filter((entry) => entry.bookId === bookId)),
  ),
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
  beforeEach(() => {
    vi.clearAllMocks();
    dbStub.entries = [];
  });

  it('renders metrics computed from the seeded insights store for this book', async () => {
    dbStub.entries = [
      { bookId: 'book-1', date: '2026-07-01', activeMinutes: 10, activePages: 5, lastUpdated: 1 },
      { bookId: 'book-1', date: '2026-07-02', activeMinutes: 15, activePages: 7, lastUpdated: 2 },
      // Another book must not leak into these totals.
      { bookId: 'book-2', date: '2026-07-02', activeMinutes: 99, activePages: 99, lastUpdated: 3 },
    ];

    render(<InfoPanel {...baseProps} />);

    const heading = await screen.findByText('reader.readingInsights');
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

  it('omits the insights section when the store holds no activity', async () => {
    render(<InfoPanel {...baseProps} />);

    await waitFor(() => {
      expect(getReadingInsightsForBook).toHaveBeenCalledWith('book-1');
    });
    expect(screen.queryByText('reader.readingInsights')).not.toBeInTheDocument();
    expect(screen.queryByText('reader.pagesRead')).not.toBeInTheDocument();
  });
});
