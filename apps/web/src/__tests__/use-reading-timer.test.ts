import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock ReadingTimer methods
const mockMarkLoaded = vi.fn();
const mockMarkPageRead = vi.fn();
const mockFlush = vi.fn().mockResolvedValue(undefined);
const mockDestroy = vi.fn();

const mockReaderState = {
  progress: { locator: null, progressPercent: 45, updatedAt: null },
};

vi.mock('../lib/offline/reading-insights', () => ({
  ReadingTimer: vi.fn().mockImplementation(function MockReadingTimer() {
    return {
      markLoaded: mockMarkLoaded,
      markPageRead: mockMarkPageRead,
      flush: mockFlush,
      destroy: mockDestroy,
    };
  }),
  computeInsightSummary: vi.fn().mockResolvedValue({
    totalActiveMinutes: 10,
    totalActivePages: 5,
    estimatedMinutesRemaining: 20,
    currentStreakDays: 3,
    recentActivity: [],
  }),
}));

// Mock useReaderStore — the hook calls useReaderStore() without a selector
// so it must return the full state object when called without args
vi.mock('../stores', () => ({
  useReaderStore: Object.assign(
    vi.fn((selector?: (state: typeof mockReaderState) => unknown) =>
      selector ? selector(mockReaderState) : mockReaderState,
    ),
    {
      getState: () => mockReaderState,
      setState: vi.fn(),
    },
  ),
}));

const mockAuthState = { sessionToken: 'tok-123' as string | null };

vi.mock('../stores/auth', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector?: (state: typeof mockAuthState) => unknown) =>
      selector ? selector(mockAuthState) : mockAuthState,
    ),
    {
      getState: () => mockAuthState,
      setState: (patch: Partial<typeof mockAuthState>) => Object.assign(mockAuthState, patch),
    },
  ),
}));

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../lib/offline', () => ({
  queueSync: vi.fn().mockResolvedValue(undefined),
  generateMutationId: vi.fn().mockReturnValue('mut-1'),
}));

vi.mock('../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
  createPerformanceMark: vi.fn(),
  measurePerformance: vi.fn(() => undefined),
}));

vi.mock('@do-epub-studio/shared', () => ({
  createTraceId: vi.fn().mockReturnValue('trace-1'),
  createSpanId: vi.fn().mockReturnValue('span-1'),
}));

vi.mock('../lib/offline/db', () => ({
  getAllReadingInsights: vi.fn().mockResolvedValue([
    { bookId: 'book-1', date: '2026-06-24', activeMinutes: 5, activePages: 2 },
  ]),
}));

import { useReadingTimer } from '../features/reader/hooks/useReadingTimer';
import { apiRequest } from '../lib/api';
import { getAllReadingInsights } from '../lib/offline/db';
import { computeInsightSummary, ReadingTimer } from '../lib/offline/reading-insights';
describe('useReadingTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.sessionToken = 'tok-123';
  });

  it('returns expected API shape', () => {
    const { result } = renderHook(() => useReadingTimer('book-1'));
    expect(typeof result.current.markLoaded).toBe('function');
    expect(typeof result.current.markPageRead).toBe('function');
    expect(typeof result.current.flush).toBe('function');
    expect(typeof result.current.syncToServer).toBe('function');
    expect(typeof result.current.getSummary).toBe('function');
  });

  it('creates ReadingTimer on mount with bookId', () => {
    renderHook(() => useReadingTimer('book-1'));
    expect(ReadingTimer).toHaveBeenCalledWith('book-1');
  });

  it('does not create ReadingTimer when bookId is null', () => {
    renderHook(() => useReadingTimer(null));
    expect(ReadingTimer).not.toHaveBeenCalled();
  });

  it('calls markLoaded on the timer', () => {
    const { result } = renderHook(() => useReadingTimer('book-1'));
    act(() => {
      result.current.markLoaded();
    });
    expect(mockMarkLoaded).toHaveBeenCalledOnce();
  });

  it('calls markPageRead on the timer', () => {
    const { result } = renderHook(() => useReadingTimer('book-1'));
    act(() => {
      result.current.markPageRead();
    });
    expect(mockMarkPageRead).toHaveBeenCalledOnce();
  });

  it('calls flush on the timer', async () => {
    const { result } = renderHook(() => useReadingTimer('book-1'));
    await act(async () => {
      await result.current.flush();
    });
    expect(mockFlush).toHaveBeenCalledOnce();
  });

  it('calls destroy on unmount', () => {
    const { unmount } = renderHook(() => useReadingTimer('book-1'));
    unmount();
    expect(mockDestroy).toHaveBeenCalled();
  });

  it('getSummary delegates to computeInsightSummary', async () => {
    const { result } = renderHook(() => useReadingTimer('book-1'));
    let summary: Awaited<ReturnType<typeof result.current.getSummary>> | undefined;
    await act(async () => {
      summary = await result.current.getSummary();
    });
    expect(computeInsightSummary).toHaveBeenCalledWith('book-1', 45);
    expect(summary).toEqual({
      totalActiveMinutes: 10,
      totalActivePages: 5,
      estimatedMinutesRemaining: 20,
      currentStreakDays: 3,
      recentActivity: [],
    });
  });

  it('getSummary returns empty defaults when bookId is null', async () => {
    const { result } = renderHook(() => useReadingTimer(null));
    let summary: Awaited<ReturnType<typeof result.current.getSummary>> | undefined;
    await act(async () => {
      summary = await result.current.getSummary();
    });
    expect(summary).toEqual({
      totalActiveMinutes: 0,
      totalActivePages: 0,
      estimatedMinutesRemaining: null,
      currentStreakDays: 0,
      recentActivity: [],
      chapterDurations: [],
      readingSpeedWpm: null,
    });
  });

  it('syncToServer returns early when no sessionToken', async () => {
    mockAuthState.sessionToken = null;
    const { result } = renderHook(() => useReadingTimer('book-1'));
    await act(async () => {
      await result.current.syncToServer();
    });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('syncToServer returns early when no bookId', async () => {
    const { result } = renderHook(() => useReadingTimer(null));
    await act(async () => {
      await result.current.syncToServer();
    });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('syncToServer posts to insights endpoint', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useReadingTimer('book-1'));
    await act(async () => {
      await result.current.syncToServer();
    });
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/books/book-1/insights/sync',
      expect.objectContaining({
        method: 'POST',
        token: 'tok-123',
      }),
    );
  });

  it('syncToServer filters entries by bookId', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: true });
    vi.mocked(getAllReadingInsights).mockResolvedValue([
      { bookId: 'book-1', date: '2026-06-24', activeMinutes: 5, activePages: 2, lastUpdated: Date.now() },
      { bookId: 'other-book', date: '2026-06-24', activeMinutes: 3, activePages: 1, lastUpdated: Date.now() },
    ]);
    const { result } = renderHook(() => useReadingTimer('book-1'));
    await act(async () => {
      await result.current.syncToServer();
    });
    const callArgs = vi.mocked(apiRequest).mock.calls[0] as [string, { body: string }];
    const callBody = JSON.parse(callArgs[1].body);
    expect(callBody.buckets).toHaveLength(1);
    expect(callBody.buckets[0]).toEqual({
      date: '2026-06-24',
      activeMinutes: 5,
      activePages: 2,
    });
  });

  it('syncToServer skips when no entries for book', async () => {
    vi.mocked(getAllReadingInsights).mockResolvedValue([
      { bookId: 'other-book', date: '2026-06-24', activeMinutes: 3, activePages: 1, lastUpdated: Date.now() },
    ]);
    const { result } = renderHook(() => useReadingTimer('book-1'));
    await act(async () => {
      await result.current.syncToServer();
    });
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
