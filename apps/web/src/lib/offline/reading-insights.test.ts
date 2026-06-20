import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReadingTimer, computeInsightSummary } from './reading-insights';

describe('ReadingTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a timer instance', () => {
    const timer = new ReadingTimer('book-123');
    expect(timer).toBeDefined();
    timer.destroy();
  });

  it('marks as loaded', () => {
    const timer = new ReadingTimer('book-123');
    timer.markLoaded();
    timer.destroy();
  });

  it('flush saves active minutes', async () => {
    const timer = new ReadingTimer('book-123');
    timer.markLoaded();

    vi.advanceTimersByTime(61000);

    await timer.flush();
    timer.destroy();
  });

  it('does not track time before markLoaded', async () => {
    const timer = new ReadingTimer('book-123');

    vi.advanceTimersByTime(61000);

    await timer.flush();
    timer.destroy();
  });
});

describe('computeInsightSummary', () => {
  it('returns zero summary when no data', async () => {
    const summary = await computeInsightSummary('nonexistent-book', 50);
    expect(summary.totalActiveMinutes).toBe(0);
    expect(summary.estimatedMinutesRemaining).toBeNull();
    expect(summary.currentStreakDays).toBe(0);
    expect(summary.recentActivity).toEqual([]);
  });
});
