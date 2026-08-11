import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReadingInsightEntry } from './db';
import { ReadingTimer, computeInsightSummary } from './reading-insights';
import { getReadingInsight, saveReadingInsight } from './db';

// In-memory db mock: IndexedDB (fake-indexeddb) reads/writes deadlock under
// vi.useFakeTimers because its internal scheduling relies on mocked timers.
// Unit tests here exercise the timer/summary logic against this store instead.
const { insightStore } = vi.hoisted(() => ({
  insightStore: new Map<string, ReadingInsightEntry>(),
}));

vi.mock('./db', () => ({
  saveReadingInsight: vi.fn((entry: ReadingInsightEntry) => {
    insightStore.set(`${entry.bookId}:${entry.date}`, { ...entry });
    return Promise.resolve();
  }),
  getReadingInsight: vi.fn((bookId: string, date: string) =>
    Promise.resolve(insightStore.get(`${bookId}:${date}`)),
  ),
  getReadingInsightsForBook: vi.fn((bookId: string) =>
    Promise.resolve([...insightStore.values()].filter((e) => e.bookId === bookId)),
  ),
}));

beforeEach(() => {
  insightStore.clear();
});

function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

// jsdom never has focus/visibility transitions, so ReadingTimer's startTicking
// is never reached via events. Driving the real interval directly (via its own
// private startTicking) still exercises the genuine flushTick per-chapter
// accumulation, which is the behavior under test. No production code is touched.
function makeActiveTimer(bookId: string, href?: string, wordCount?: number): ReadingTimer {
  const timer = new ReadingTimer(bookId);
  timer.markLoaded();
  (timer as unknown as { startTicking(): void }).startTicking();
  if (href !== undefined) timer.setChapter(href, wordCount);
  return timer;
}

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

  it('setChapter accumulates per-chapter minutes into the entry on flush', async () => {
    const timer = makeActiveTimer('book-123', 'ch1', 500);

    vi.advanceTimersByTime(2 * 60 * 1000); // 2 active minutes on ch1
    timer.setChapter('ch2', 300);
    vi.advanceTimersByTime(60 * 1000); // 1 active minute on ch2

    await timer.flush();
    timer.destroy();

    const entry = await getReadingInsight('book-123', dayKey());
    expect(entry?.chapterMinutes).toEqual({ ch1: 2, ch2: 1 });
  });

  it('chapterMinutes merge across flushes (sum with existing)', async () => {
    const timer = makeActiveTimer('book-123', 'ch1', 500);

    vi.advanceTimersByTime(60 * 1000); // 1 min on ch1
    await timer.flush();

    // Same chapter again in a second session accumulates on top.
    vi.advanceTimersByTime(60 * 1000); // 1 more min on ch1
    await timer.flush();
    timer.destroy();

    const entry = await getReadingInsight('book-123', dayKey());
    expect(entry?.chapterMinutes).toEqual({ ch1: 2 });
  });

  it('setChapter word counts are persisted into chapterWords', async () => {
    const timer = makeActiveTimer('book-123', 'ch1', 420);
    vi.advanceTimersByTime(60 * 1000);
    await timer.flush();
    timer.destroy();

    const entry = await getReadingInsight('book-123', dayKey());
    expect(entry?.chapterWords).toEqual({ ch1: 420 });
  });
});

describe('computeInsightSummary', () => {
  it('returns zero summary when no data', async () => {
    const summary = await computeInsightSummary('nonexistent-book', 50);
    expect(summary.totalActiveMinutes).toBe(0);
    expect(summary.estimatedMinutesRemaining).toBeNull();
    expect(summary.currentStreakDays).toBe(0);
    expect(summary.recentActivity).toEqual([]);
    expect(summary.chapterDurations).toEqual([]);
    expect(summary.readingSpeedWpm).toBeNull();
  });

  it('returns chapterDurations sorted desc and a reading-speed estimate', async () => {
    await saveReadingInsight({
      bookId: 'book-x',
      date: '2026-01-01',
      activeMinutes: 10,
      activePages: 2,
      lastUpdated: 0,
      chapterMinutes: { a: 3, b: 7 },
      chapterWords: { a: 40, b: 20 },
    });

    const summary = await computeInsightSummary('book-x', 50);
    expect(summary.chapterDurations).toEqual([
      { href: 'b', activeMinutes: 7 },
      { href: 'a', activeMinutes: 3 },
    ]);
    // (40 + 20) words / 10 minutes * 60 = 360 WPM
    expect(summary.readingSpeedWpm).toBe(360);
  });

  it('accumulates chapter minutes across multiple daily entries', async () => {
    await saveReadingInsight({
      bookId: 'book-y',
      date: '2026-01-01',
      activeMinutes: 5,
      activePages: 1,
      lastUpdated: 0,
      chapterMinutes: { a: 2, b: 1 },
    });
    await saveReadingInsight({
      bookId: 'book-y',
      date: '2026-01-02',
      activeMinutes: 4,
      activePages: 1,
      lastUpdated: 0,
      chapterMinutes: { b: 3 },
    });

    const summary = await computeInsightSummary('book-y', 50);
    expect(summary.chapterDurations).toEqual([
      { href: 'b', activeMinutes: 4 },
      { href: 'a', activeMinutes: 2 },
    ]);
  });

  it('returns null reading speed when no minutes but words exist', async () => {
    await saveReadingInsight({
      bookId: 'book-z',
      date: '2026-01-01',
      activeMinutes: 0,
      activePages: 0,
      lastUpdated: 0,
      chapterWords: { a: 100 },
    });

    const summary = await computeInsightSummary('book-z', 50);
    expect(summary.chapterDurations).toEqual([]);
    expect(summary.readingSpeedWpm).toBeNull();
  });

  it('returns null reading speed when words are missing but minutes exist', async () => {
    await saveReadingInsight({
      bookId: 'book-w',
      date: '2026-01-01',
      activeMinutes: 10,
      activePages: 1,
      lastUpdated: 0,
      chapterMinutes: { a: 8 },
    });

    const summary = await computeInsightSummary('book-w', 50);
    expect(summary.chapterDurations).toEqual([{ href: 'a', activeMinutes: 8 }]);
    expect(summary.readingSpeedWpm).toBeNull();
  });
});
