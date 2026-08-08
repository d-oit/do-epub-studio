import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InfoPanel } from './InfoPanel';
import * as readingInsights from '../../../../lib/offline/reading-insights';

vi.mock('../../../../lib/offline/reading-insights', async (importOriginal) => {
  const actual = await importOriginal<typeof readingInsights>();
  return { ...actual, computeInsightSummary: vi.fn() };
});

const mockCompute = readingInsights.computeInsightSummary as unknown as ReturnType<typeof vi.fn>;

const summary = {
  totalActiveMinutes: 30,
  totalActivePages: 5,
  estimatedMinutesRemaining: 12,
  currentStreakDays: 2,
  recentActivity: [],
};

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  metadata: { title: 'Test Book' },
  bookId: 'book-1',
  progressPercent: 50,
  t: (key: string) => key,
};

describe('InfoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders insights once computeInsightSummary resolves', async () => {
    mockCompute.mockResolvedValue(summary);

    render(<InfoPanel {...baseProps} />);

    expect(await screen.findByText('reader.totalActiveTime')).toBeInTheDocument();
    expect(mockCompute).toHaveBeenCalledWith('book-1', 50);
  });

  it('does not set state after unmount when the promise resolves late', async () => {
    let resolveCompute!: (value: typeof summary) => void;
    mockCompute.mockReturnValue(new Promise<typeof summary>((resolve) => { resolveCompute = resolve; }));

    const onClose = vi.fn();
    const { unmount } = render(<InfoPanel {...baseProps} onClose={onClose} />);

    unmount();
    // Resolve after unmount — must not throw or warn about state updates on unmounted component.
    resolveCompute(summary);
    await Promise.resolve();

    expect(mockCompute).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('reader.totalActiveTime')).not.toBeInTheDocument();
  });

  it('does not set state after unmount when the promise rejects late', async () => {
    let rejectCompute!: (err: Error) => void;
    mockCompute.mockReturnValue(new Promise<typeof summary>((_, reject) => { rejectCompute = reject; }));

    const { unmount } = render(<InfoPanel {...baseProps} />);

    unmount();
    rejectCompute(new Error('boom'));
    await Promise.resolve();

    expect(mockCompute).toHaveBeenCalledTimes(1);
  });
});
