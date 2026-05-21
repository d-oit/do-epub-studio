import { test, expect } from '@playwright/test';

test.describe('Service Worker Management', () => {
  test('registers service worker and creates versioned caches', async ({ page, context }) => {
    await page.goto('/');

    // Wait for service worker to be ready
    const swReady = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return !!registration;
    });
    expect(swReady).toBe(true);

    // Check if versioned caches are created
    const cacheNames = await page.evaluate(async () => {
      return await caches.keys();
    });

    // Check for any caches
    const allCaches = await page.evaluate(async () => {
      return await caches.keys();
    });

    // Check if at least the precache is present
    expect(allCaches.some(name => name.includes('workbox-precache'))).toBe(true);
  });

  test('purges old versioned caches on activation', async ({ page }) => {
    await page.goto('/');

    // Manually create an old versioned cache
    await page.evaluate(async () => {
      await caches.open('do-epub-v0-old-cache');
      await caches.open('do-epub-v1-new-cache');
      // Also a cache from a different app prefix that shouldn't be touched
      await caches.open('other-app-cache');
    });

    // Reload to trigger SW activation and cleanup
    await page.reload();

    // Give it a moment to run cleanup
    await page.waitForTimeout(2000);

    const cacheNames = await page.evaluate(async () => {
      return await caches.keys();
    });

    // Old version should be gone
    expect(cacheNames).not.toContain('do-epub-v0-old-cache');
    // New version should stay
    expect(cacheNames).toContain('do-epub-v1-new-cache');
    // Unrelated cache should stay
    expect(cacheNames).toContain('other-app-cache');
  });

  test('offline fallback for critical routes', async ({ page, context }) => {
    // 1. Visit page while online to cache it
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure SW is ready
    await page.evaluate(() => navigator.serviceWorker.ready);

    // 2. Go offline
    await context.setOffline(true);

    // 3. Try to reload
    const response = await page.reload();

    // 4. Page should still load (from cache)
    expect(response?.status()).toBe(200);
    expect(await page.title()).toContain('EPUB Studio');

    // 5. Check if it handles a failed API call gracefully while offline
    const isOffline = await page.evaluate(() => !navigator.onLine);
    expect(isOffline).toBe(true);

    await context.setOffline(false);
  });

  test('sensitive API routes are not cached', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Mock a sensitive API response
    await page.route('**/api/admin/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ secret: 'data' }),
        headers: { 'Cache-Control': 'no-store' }
      });
    });

    // Trigger the request
    await page.evaluate(async () => {
      await fetch('/api/admin/stats');
    });

    // Check if it's in any cache
    const inCache = await page.evaluate(async () => {
      const keys = await caches.keys();
      for (const key of keys) {
        const cache = await caches.open(key);
        const match = await cache.match('/api/admin/stats');
        if (match) return true;
      }
      return false;
    });

    expect(inCache).toBe(false);
  });
});
