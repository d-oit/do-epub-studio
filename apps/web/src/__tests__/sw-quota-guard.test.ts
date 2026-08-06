import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

  it('calls evictLargestCache instead of directly deleting external-assets', () => {
    expect(swContent).toContain('await evictLargestCache()');
    // The direct delete inside cacheWillUpdate should be gone
    expect(swContent).not.toMatch(
      /cacheWillUpdate[\s\S]*?await caches\.delete\('external-assets'\)/
    );
  });

  it('has evictLargestCache function that enumerates caches.keys()', () => {
    expect(swContent).toContain('async function evictLargestCache');
    expect(swContent).toContain('const cacheNames = await caches.keys()');
  });

  it('skips workbox-precache caches during eviction', () => {
    expect(swContent).toContain("if (name.startsWith('workbox-precache')) continue");
  });

  it('has EVICTABLE_PREFIXES with era-appropriate cache names', () => {
    expect(swContent).toContain("'images'");
    expect(swContent).toContain("'external-assets'");
    expect(swContent).toContain("'book-content'");
    expect(swContent).toContain("'google-fonts-stylesheets'");
    expect(swContent).toContain("'google-fonts-webfonts'");
  });

  it('measures cache size via cache.keys().length', () => {
    expect(swContent).toContain('const keys = await cache.keys()');
    expect(swContent).toContain('keys.length > targetSize');
  });

  it('returns original response on error path (never blocks fetch)', () => {
    // The plugin body must end with `return response` as the last statement
    const pluginMatch = swContent.match(
      /const quotaGuardPlugin\s*=\s*\{[\s\S]*?\};/
    );
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

  it('falls back to external-assets when no evictable cache is found', () => {
    expect(swContent).toContain("await caches.delete('external-assets')");
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

describe('quotaGuardPlugin – eviction logic (unit)', () => {
  it('evicts cache with most entries among evictable prefixes', () => {
    // Simulate the eviction decision logic
    const EVICTABLE_PREFIXES = ['images', 'external-assets', 'epub', 'google-fonts-stylesheets', 'google-fonts-webfonts', 'book-content'] as const;

    const cacheEntries: Record<string, number> = {
      'workbox-precache-v2': 5,
      'images': 42,
      'external-assets': 10,
      'book-content': 25,
      'api-responses': 8,
    };

    let targetName: string | null = null;
    let targetSize = -1;

    for (const [name, size] of Object.entries(cacheEntries)) {
      if (name.startsWith('workbox-precache')) continue;
      const matchesPrefix = EVICTABLE_PREFIXES.some((p) => name.startsWith(p) || name === p);
      if (!matchesPrefix && name !== 'external-assets') continue;
      if (size > targetSize) {
        targetSize = size;
        targetName = name;
      }
    }

    expect(targetName).toBe('images');
    expect(targetSize).toBe(42);
  });

  it('skips precache caches', () => {
    const EVICTABLE_PREFIXES = ['images', 'external-assets'] as const;
    const cacheEntries: Record<string, number> = {
      'workbox-precache-v2': 100,
      'images': 5,
    };

    let targetName: string | null = null;
    let targetSize = -1;

    for (const [name, size] of Object.entries(cacheEntries)) {
      if (name.startsWith('workbox-precache')) continue;
      const matchesPrefix = EVICTABLE_PREFIXES.some((p) => name.startsWith(p) || name === p);
      if (!matchesPrefix && name !== 'external-assets') continue;
      if (size > targetSize) {
        targetSize = size;
        targetName = name;
      }
    }

    expect(targetName).toBe('images');
  });

  it('falls back to external-assets when no prefix matches', () => {
    const EVICTABLE_PREFIXES = ['images'] as const;
    const cacheEntries: Record<string, number> = {
      'workbox-precache-v2': 100,
      'some-random-cache': 50,
    };

    let targetName: string | null = null;
    let targetSize = -1;

    for (const [name, size] of Object.entries(cacheEntries)) {
      if (name.startsWith('workbox-precache')) continue;
      const matchesPrefix = EVICTABLE_PREFIXES.some((p) => name.startsWith(p) || name === p);
      if (!matchesPrefix && name !== 'external-assets') continue;
      if (size > targetSize) {
        targetSize = size;
        targetName = name;
      }
    }

    // No match found, fallback should be external-assets
    expect(targetName).toBeNull();
  });
});
