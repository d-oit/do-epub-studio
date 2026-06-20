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

export class ReadingTimer {
  private bookId: string;
  private activeSeconds = 0;
  private lastTick: number | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isIdle = false;
  private isVisible = true;
  private isFocused = true;
  private isLoaded = false;

  constructor(bookId: string) {
    this.bookId = bookId;
    this.bindEvents();
  }

  private bindEvents(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('focus', this.onFocus);
    window.addEventListener('blur', this.onBlur);
  }

  private unbindEvents(): void {
    if (typeof document === 'undefined') return;

    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('focus', this.onFocus);
    window.removeEventListener('blur', this.onBlur);
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

  markLoaded(): void {
    this.isLoaded = true;
    this.updateActiveState();
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
      this.resetIdleTimer();
    }, POLL_INTERVAL_MS);
  }

  private stopTicking(): void {
    this.flushTick();
    this.clearTimers();
  }

  private flushTick(): void {
    if (this.lastTick === null) return;
    const elapsed = Math.floor((Date.now() - this.lastTick) / 1000);
    this.activeSeconds += elapsed;
    this.lastTick = Date.now();
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
    const activeMinutes = Math.round(this.activeSeconds / 60);
    if (activeMinutes <= 0) return;

    const date = todayKey();
    const existing = await getReadingInsight(this.bookId, date);
    const totalMinutes = (existing?.activeMinutes ?? 0) + activeMinutes;

    await saveReadingInsight({
      bookId: this.bookId,
      date,
      activeMinutes: totalMinutes,
      lastUpdated: Date.now(),
    });

    this.activeSeconds = 0;
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
  estimatedMinutesRemaining: number | null;
  currentStreakDays: number;
  recentActivity: { date: string; activeMinutes: number }[];
}> {
  const entries = await getReadingInsightsForBook(bookId);
  const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));

  const totalActiveMinutes = sorted.reduce((sum, e) => sum + e.activeMinutes, 0);

  let estimatedMinutesRemaining: number | null = null;
  if (progressPercent > 0 && progressPercent < 100 && totalActiveMinutes > 0) {
    const estimatedTotal = (totalActiveMinutes / progressPercent) * 100;
    estimatedMinutesRemaining = Math.round(estimatedTotal - totalActiveMinutes);
  }

  const currentStreakDays = computeStreak(sorted);

  const recentActivity = sorted.slice(-7).map((e) => ({
    date: e.date,
    activeMinutes: e.activeMinutes,
  }));

  return {
    totalActiveMinutes,
    estimatedMinutesRemaining,
    currentStreakDays,
    recentActivity,
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
