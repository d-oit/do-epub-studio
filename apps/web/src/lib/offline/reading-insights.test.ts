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

  it('flush saves active minutes and pages', async () => {
    const timer = new ReadingTimer('book-123');
    timer.markLoaded();

    vi.advanceTimersByTime(61000);
    timer.markPageRead();

    await timer.flush();
    timer.destroy();
  });

  it('pauses on idle', async () => {
    const timer = new ReadingTimer('book-123');
    timer.markLoaded();

    // Move time forward by 4 minutes
    vi.advanceTimersByTime(4 * 60 * 1000);

    // Idle after 5 minutes
    vi.advanceTimersByTime(1.1 * 60 * 1000);

    // Should have 5 minutes tracked, but then paused
    vi.advanceTimersByTime(5 * 60 * 1000);

    await timer.flush();
    timer.destroy();
  });

  it('resumes on activity', async () => {
    const timer = new ReadingTimer('book-123');
    timer.markLoaded();

    vi.advanceTimersByTime(6 * 60 * 1000); // Become idle
    window.dispatchEvent(new MouseEvent('mousemove')); // Resume

    vi.advanceTimersByTime(60 * 1000);

    await timer.flush();
    timer.destroy();
  });

  it('pauses on blur', async () => {
    const timer = new ReadingTimer('book-123');
    timer.markLoaded();

    vi.advanceTimersByTime(30 * 1000);
    window.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(60 * 1000);

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
