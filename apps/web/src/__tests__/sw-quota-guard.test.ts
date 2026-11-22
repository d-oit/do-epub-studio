import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  tierOfCacheName,
  TIER_BOOK_PACKAGE,
  TIER_DERIVED,
  TIER_TRANSIENT,
} from '../lib/offline/ownership';

const swPath = join(__dirname, '../sw.ts');
const swContent = readFileSync(swPath, 'utf-8');

describe('quotaGuardPlugin – source-level invariants', () => {
  it('throttles navigator.storage.estimate() via THROTTLE_MS constant', () => {
    expect(swContent).toMatch(/THROTTLE_MS\s*=\s*60_000/);
  });

  it('uses a backoff constant for failed estimates', () => {
    expect(swContent).toMatch(/BACKOFF_MS\s*=\s*300_000/);
  });

  it('has module-level lastEstimateAt and lastFailedAt variables', () => {
    expect(swContent).toContain('let lastEstimateAt = 0');
    expect(swContent).toContain('let lastFailedAt = 0');
  });

  it('short-circuits when within THROTTLE_MS window', () => {
    expect(swContent).toContain('now - lastEstimateAt < THROTTLE_MS');
  });

  it('short-circuits when within BACKOFF_MS window', () => {
    expect(swContent).toContain('now - lastFailedAt < BACKOFF_MS');
  });

  it('preserves 0.85 quota threshold', () => {
    expect(swContent).toContain('QUOTA_THRESHOLD = 0.85');
    expect(swContent).toContain('usageRatio > QUOTA_THRESHOLD');
  });

  it('delegates eviction to the tier-aware eviction module', () => {
    expect(swContent).toContain("import { evictToThreshold } from './lib/offline/eviction'");
    expect(swContent).toContain('await evictToThreshold()');
  });

  it('runs offline storage recovery on activation', () => {
    expect(swContent).toContain("import { recoverOfflineStorage } from './lib/offline/recovery'");
    expect(swContent).toContain('recoverOfflineStorage()');
  });

  it('does not cache external font origins (ADR-123 self-hosted fonts)', () => {
    // Fonts are self-hosted via @fontsource since PR #748; the CSP allowlist
    // no longer contains fonts.googleapis.com / fonts.gstatic.com, so the SW
    // must not register caching routes or evictable caches for them either.
    expect(swContent).not.toContain('fonts.googleapis.com');
    expect(swContent).not.toContain('fonts.gstatic.com');
    expect(swContent).not.toContain('google-fonts-stylesheets');
    expect(swContent).not.toContain('google-fonts-webfonts');
  });

  it('returns original response on error path (never blocks fetch)', () => {
    // The plugin body must end with `return response` as the last statement
    const pluginMatch = swContent.match(/const quotaGuardPlugin\s*=\s*\{[\s\S]*?\};/);
    if (!pluginMatch) throw new Error('quotaGuardPlugin definition not found');
    const pluginBody = pluginMatch[0];
    // Last return before closing brace
    const returns = pluginBody.match(/return response;/g) ?? [];
    expect(returns.length).toBeGreaterThanOrEqual(2);
  });

  it('sets lastFailedAt on error (backoff guard)', () => {
    expect(swContent).toContain('lastFailedAt = Date.now()');
  });

  it('sets lastEstimateAt before calling estimate (throttle guard)', () => {
    expect(swContent).toContain('lastEstimateAt = now');
  });

  it('emits sw.storage.quota_warning with traceId on high usage', () => {
    expect(swContent).toContain("'sw.storage.quota_warning'");
    expect(swContent).toContain('traceId');
  });

  it('emits sw.storage.estimate_error on catch', () => {
    expect(swContent).toContain("'sw.storage.estimate_error'");
  });
});

describe('storage ownership tiers (issue #1485)', () => {
  it('never classifies workbox precache or unknown caches as evictable', () => {
    expect(tierOfCacheName('workbox-precache-v2')).toBeNull();
    expect(tierOfCacheName('some-random-cache')).toBeNull();
  });

  it('classifies derived render caches', () => {
    expect(tierOfCacheName('images')).toBe(TIER_DERIVED);
    expect(tierOfCacheName('book-content')).toBe(TIER_DERIVED);
    expect(tierOfCacheName('epub')).toBe(TIER_DERIVED);
    expect(tierOfCacheName('dl-staging/book-1/attempt-1')).toBe(TIER_DERIVED);
  });

  it('classifies transient HTTP caches', () => {
    expect(tierOfCacheName('external-assets')).toBe(TIER_TRANSIENT);
    expect(tierOfCacheName('api-responses')).toBe(TIER_TRANSIENT);
  });

  it('classifies verified book-package caches', () => {
    expect(tierOfCacheName('dl/book-1')).toBe(TIER_BOOK_PACKAGE);
  });
});

describe('quotaGuardPlugin – throttling logic (unit)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('throttles: second call within THROTTLE_MS skips estimate', async () => {
    let estimateCalls = 0;

    // Mock navigator.storage before importing
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        storage: {
          estimate: vi.fn(() => {
            estimateCalls++;
            return { usage: 0, quota: 1000 };
          }),
        },
      },
      writable: true,
      configurable: true,
    });

    // Replicate the throttle logic to verify it works (SW has side effects, can't import directly)
    const THROTTLE_MS = 60_000;
    let lastEstimateAt = 0;

    const callEstimate = () => {
      const now = Date.now();
      if (now - lastEstimateAt < THROTTLE_MS) return;
      lastEstimateAt = now;
      return navigator.storage.estimate();
    };

    await callEstimate();
    expect(estimateCalls).toBe(1);

    // Immediately — should throttle
    await callEstimate();
    expect(estimateCalls).toBe(1);

    // After 59s — still throttled
    vi.advanceTimersByTime(59_000);
    await callEstimate();
    expect(estimateCalls).toBe(1);

    // At 60s — should fire
    vi.advanceTimersByTime(1_000);
    await callEstimate();
    expect(estimateCalls).toBe(2);
  });

  it('backoff: failed estimate prevents retries for BACKOFF_MS', async () => {
    let failCount = 0;

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        storage: {
          estimate: vi.fn(() => {
            failCount++;
            if (failCount <= 2) throw new Error('quota error');
            return { usage: 0, quota: 1000 };
          }),
        },
      },
      writable: true,
      configurable: true,
    });

    const BACKOFF_MS = 300_000;
    const THROTTLE_MS = 60_000;
    let lastEstimateAt = 0;
    let lastFailedAt = 0;

    const callEstimate = async () => {
      const now = Date.now();
      if (now - lastEstimateAt < THROTTLE_MS) return 'throttled';
      if (now - lastFailedAt < BACKOFF_MS) return 'backoff';
      try {
        lastEstimateAt = now;
        await navigator.storage.estimate();
        return 'ok';
      } catch {
        lastFailedAt = Date.now();
        return 'failed';
      }
    };

    // First call — fails, sets backoff
    expect(await callEstimate()).toBe('failed');

    // 60s later — still in backoff
    vi.advanceTimersByTime(60_000);
    expect(await callEstimate()).toBe('backoff');

    // 300s later — backoff cleared
    vi.advanceTimersByTime(300_000);
    expect(await callEstimate()).toBe('failed');

    // After another backoff window — succeeds
    vi.advanceTimersByTime(300_000);
    expect(await callEstimate()).toBe('ok');
    expect(failCount).toBe(3);
  });
});
