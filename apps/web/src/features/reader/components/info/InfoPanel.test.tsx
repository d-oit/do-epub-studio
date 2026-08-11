import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type ReactNode } from 'react';
import { InfoPanel } from './InfoPanel';
import * as readingInsights from '../../../../lib/offline/reading-insights';

vi.mock('../../../../lib/offline/reading-insights', async (importOriginal) => {
  const actual = await importOriginal<typeof readingInsights>();
  return { ...actual, computeInsightSummary: vi.fn() };
});

const mockUseFocusTrap = vi.fn();
vi.mock('@do-epub-studio/ui', () => ({
  useFocusTrap: (...args: unknown[]) => mockUseFocusTrap(...args),
  IconButton: ({ children, onClick, 'aria-label': ariaLabel }: { children: ReactNode; onClick: () => void; 'aria-label': string }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel}>{children}</button>
  ),
}));

const mockCompute = readingInsights.computeInsightSummary as unknown as ReturnType<typeof vi.fn>;

const summary = {
  totalActiveMinutes: 30,
  totalActivePages: 5,
  estimatedMinutesRemaining: 12,
  currentStreakDays: 2,
  recentActivity: [],
  chapterDurations: [],
  readingSpeedWpm: null,
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

  it('calls useFocusTrap with isOpen and the panel ref when open', () => {
    mockCompute.mockResolvedValue(null);
    render(<InfoPanel {...baseProps} isOpen={true} />);
    expect(mockUseFocusTrap).toHaveBeenCalledWith(true, expect.objectContaining({ current: expect.any(HTMLElement) }));
  });

  it('calls useFocusTrap with false when closed', () => {
    mockCompute.mockResolvedValue(null);
    render(<InfoPanel {...baseProps} isOpen={false} />);
    expect(mockUseFocusTrap).toHaveBeenCalledWith(false, expect.objectContaining({ current: null }));
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

  it('renders chapter time and reading speed when present', async () => {
    mockCompute.mockResolvedValue({
      ...summary,
      chapterDurations: [{ href: 'ch1', activeMinutes: 12 }],
      readingSpeedWpm: 250,
    });

    render(<InfoPanel {...baseProps} />);

    expect(await screen.findByText('reader.chapterTime')).toBeInTheDocument();
    expect(screen.getByText('reader.chapterTimeValue')).toBeInTheDocument();
    expect(screen.getByText('reader.readingSpeed')).toBeInTheDocument();
    expect(screen.getByText('reader.readingSpeedValue')).toBeInTheDocument();
  });

  it('hides chapter time and reading speed when absent', async () => {
    mockCompute.mockResolvedValue(summary);

    render(<InfoPanel {...baseProps} />);

    expect(await screen.findByText('reader.totalActiveTime')).toBeInTheDocument();
    expect(screen.queryByText('reader.chapterTime')).not.toBeInTheDocument();
    expect(screen.queryByText('reader.chapterTimeValue')).not.toBeInTheDocument();
    expect(screen.queryByText('reader.readingSpeed')).not.toBeInTheDocument();
    expect(screen.queryByText('reader.readingSpeedValue')).not.toBeInTheDocument();
  });
});
