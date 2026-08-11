import {
  saveReadingInsight,
  getReadingInsight,
  getReadingInsightsForBook,
} from './db';
import type { ReadingInsightEntry } from './db';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL_MS = 60 * 1000; // 1 minute (for rounding)

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Rough word count for a section of rendered text: whitespace-separated tokens.
 * Book-level reading speed is estimated from these counts.
 */
export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export class ReadingTimer {
  private bookId: string;
  private activeSeconds = 0;
  private activePages = 0;
  private lastTick: number | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isIdle = false;
  private isVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
  private isFocused = typeof document !== 'undefined' ? document.hasFocus() : true;
  private isLoaded = false;
  private chapterHref: string | null = null;
  private chapterSeconds: Record<string, number> = {};
  private wordsByChapter: Record<string, number> = {};

  constructor(bookId: string) {
    this.bookId = bookId;
    this.bindEvents();
  }

  private bindEvents(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('focus', this.onFocus);
    window.addEventListener('blur', this.onBlur);

    const activityEvents = ['mousemove', 'keydown', 'touchstart', 'scroll'];
    for (const event of activityEvents) {
      window.addEventListener(event, this.onActivity, { passive: true });
    }
  }

  private unbindEvents(): void {
    if (typeof document === 'undefined') return;

    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('focus', this.onFocus);
    window.removeEventListener('blur', this.onBlur);

    const activityEvents = ['mousemove', 'keydown', 'touchstart', 'scroll'];
    for (const event of activityEvents) {
      window.removeEventListener(event, this.onActivity);
    }
  }

  private onVisibilityChange = (): void => {
    this.isVisible = document.visibilityState === 'visible';
    this.updateActiveState();
  };

  private onFocus = (): void => {
    this.isFocused = true;
    this.updateActiveState();
  };

  private onBlur = (): void => {
    this.isFocused = false;
    this.updateActiveState();
  };

  private onActivity = (): void => {
    if (this.isIdle) {
      this.isIdle = false;
      this.updateActiveState();
    }
    this.resetIdleTimer();
  };

  markLoaded(): void {
    this.isLoaded = true;
    this.updateActiveState();
  }

  markPageRead(): void {
    if (this.isActive()) {
      this.activePages++;
    }
  }

  /**
   * Record the currently-displayed chapter. Called once per location change.
   * Subsequent active seconds are attributed to this chapter; wordCount (the
   * section's rough token count) is retained for the reading-speed estimate.
   */
  setChapter(href: string | null, wordCount?: number): void {
    this.chapterHref = href;
    if (href && wordCount !== undefined && wordCount > 0) {
      this.wordsByChapter[href] = wordCount;
    }
  }

  private updateActiveState(): void {
    const wasActive = this.isActive();
    const nowActive = this.isVisible && this.isFocused && this.isLoaded && !this.isIdle;

    if (nowActive && !wasActive) {
      this.startTicking();
    } else if (!nowActive && wasActive) {
      this.stopTicking();
    }
  }

  private isActive(): boolean {
    return this.isVisible && this.isFocused && this.isLoaded && !this.isIdle;
  }

  private startTicking(): void {
    this.lastTick = Date.now();
    this.resetIdleTimer();

    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      this.flushTick();
    }, POLL_INTERVAL_MS);
  }

  private stopTicking(): void {
    this.flushTick();
    this.clearTimers();
  }

  private flushTick(): void {
    if (this.lastTick === null) return;
    const now = Date.now();
    const elapsedSeconds = (now - this.lastTick) / 1000;
    this.activeSeconds += elapsedSeconds;
    if (this.chapterHref) {
      this.chapterSeconds[this.chapterHref] =
        (this.chapterSeconds[this.chapterHref] ?? 0) + elapsedSeconds;
    }
    this.lastTick = now;
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.isIdle = true;
      this.updateActiveState();
    }, IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private clearTimers(): void {
    this.lastTick = null;
    this.clearIdleTimer();
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async flush(): Promise<void> {
    this.flushTick();
    const fullMinutes = Math.floor(this.activeSeconds / 60);
    const pagesToSave = this.activePages;

    if (fullMinutes <= 0 && pagesToSave <= 0) return;

    const date = todayKey();
    const existing = await getReadingInsight(this.bookId, date);
    const totalMinutes = (existing?.activeMinutes ?? 0) + fullMinutes;
    const totalPages = (existing?.activePages ?? 0) + pagesToSave;

    // Merge per-chapter minutes (rounded to whole minutes) and word counts.
    const chapterMinutes = { ...(existing?.chapterMinutes ?? {}) };
    for (const [href, seconds] of Object.entries(this.chapterSeconds)) {
      const mins = Math.floor(seconds / 60);
      if (mins <= 0) continue;
      chapterMinutes[href] = (chapterMinutes[href] ?? 0) + mins;
      this.chapterSeconds[href] = seconds - mins * 60;
    }
    const chapterWords = { ...(existing?.chapterWords ?? {}), ...this.wordsByChapter };

    await saveReadingInsight({
      bookId: this.bookId,
      date,
      activeMinutes: totalMinutes,
      activePages: totalPages,
      lastUpdated: Date.now(),
      chapterMinutes,
      chapterWords,
    });

    this.activeSeconds -= fullMinutes * 60;
    this.activePages = 0;
    this.wordsByChapter = {};
  }

  destroy(): void {
    this.stopTicking();
    this.unbindEvents();
  }
}

export async function computeInsightSummary(
  bookId: string,
  progressPercent: number,
): Promise<{
  totalActiveMinutes: number;
  totalActivePages: number;
  estimatedMinutesRemaining: number | null;
  currentStreakDays: number;
  recentActivity: { date: string; activeMinutes: number; activePages: number }[];
  chapterDurations: { href: string; activeMinutes: number }[];
  readingSpeedWpm: number | null;
}> {
  const entries = await getReadingInsightsForBook(bookId);
  const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));

  const totalActiveMinutes = sorted.reduce((sum, e) => sum + e.activeMinutes, 0);
  const totalActivePages = sorted.reduce((sum, e) => sum + (e.activePages ?? 0), 0);

  let estimatedMinutesRemaining: number | null = null;
  if (progressPercent > 0 && progressPercent < 100 && totalActiveMinutes > 0) {
    const estimatedTotal = (totalActiveMinutes / progressPercent) * 100;
    estimatedMinutesRemaining = Math.round(estimatedTotal - totalActiveMinutes);
  }

  const currentStreakDays = computeStreak(sorted);

  const recentActivity = sorted.slice(-7).map((e) => ({
    date: e.date,
    activeMinutes: e.activeMinutes,
    activePages: e.activePages ?? 0,
  }));

  // Aggregate per-chapter durations and word counts across all daily entries.
  const chapterMinutes: Record<string, number> = {};
  const chapterWords: Record<string, number> = {};
  for (const e of sorted) {
    for (const [href, mins] of Object.entries(e.chapterMinutes ?? {})) {
      chapterMinutes[href] = (chapterMinutes[href] ?? 0) + mins;
    }
    for (const [href, words] of Object.entries(e.chapterWords ?? {})) {
      chapterWords[href] = Math.max(chapterWords[href] ?? 0, words);
    }
  }
  const chapterDurations = Object.entries(chapterMinutes)
    .map(([href, activeMinutes]) => ({ href, activeMinutes }))
    .sort((a, b) => b.activeMinutes - a.activeMinutes);

  const totalWords = Object.values(chapterWords).reduce((sum, w) => sum + w, 0);
  const readingSpeedWpm =
    totalWords > 0 && totalActiveMinutes > 0
      ? Math.round((totalWords / totalActiveMinutes) * 60)
      : null;

  return {
    totalActiveMinutes,
    totalActivePages,
    estimatedMinutesRemaining,
    currentStreakDays,
    recentActivity,
    chapterDurations,
    readingSpeedWpm,
  };
}

function computeStreak(sorted: ReadingInsightEntry[]): number {
  if (sorted.length === 0) return 0;

  const today = todayKey();
  const dates = new Set(sorted.map((e) => e.date));

  if (!dates.has(today)) return 0;

  let streak = 1;
  let current = new Date(today);

  while (true) {
    current = new Date(current);
    current.setDate(current.getDate() - 1);
    const key = current.toISOString().slice(0, 10);
    if (dates.has(key)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
