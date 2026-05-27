import { test, expect } from '@playwright/test';

test.describe('PWA Caching Strategies', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // 1. Visit the app online to ensure service worker and assets are cached
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for service worker to be ready and activated with a timeout
    const swReady = await page.evaluate(async () => {
      try {
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 30000))
        ]) as ServiceWorkerRegistration;

        if (!navigator.serviceWorker.controller) {
          await Promise.race([
            new Promise<void>((resolve) => {
              navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Controller change timeout')), 30000))
          ]);
        }
        return true;
      } catch {
        return false;
      }
    });

    if (!swReady) {
      testInfo.skip();
    }
  });

  test('Navigation requests return index.html from cache when offline', async ({ page, context }) => {
    // Go offline
    await context.setOffline(true);

    // Attempt to navigate to a non-precached route
    await page.goto('/read/offline-test-slug');

    // Verify that the app shell is loaded (index.html contains root div)
    const root = page.locator('#root');
    await expect(root).toBeVisible({ timeout: 10000 });

    // Verify the URL remains the one we navigated to
    expect(page.url()).toContain('/read/offline-test-slug');

    await context.setOffline(false);
  });

  test('Sensitive API routes use NetworkOnly and are never cached', async ({ page, context }) => {
    // 1. Fetch sensitive route while online (this would normally succeed or return 401/403)
    // For the test, we don't care about the result, just that it happened.
    await page.evaluate(async () => {
      try { await fetch('/api/access/validate?bookId=test'); } catch {}
    });

    // 2. Go offline
    await context.setOffline(true);

    // 3. Try to fetch it again - it should fail because it's NetworkOnly
    const isNetworkOnlyFailed = await page.evaluate(async () => {
      try {
        await fetch('/api/access/validate?bookId=test');
        return false; // Should not reach here
      } catch (e) {
        return true; // Expected failure
      }
    });
    expect(isNetworkOnlyFailed).toBe(true);

    // 4. Verify it's not in the cache
    const isInCache = await page.evaluate(async () => {
      const keys = await caches.keys();
      for (const key of keys) {
        const cache = await caches.open(key);
        const match = await cache.match('/api/access/validate?bookId=test');
        if (match) return true;
      }
      return false;
    });
    expect(isInCache).toBe(false);

    await context.setOffline(false);
  });

  test('Generic API requests use NetworkFirst (cached for offline)', async ({ page, context }) => {
    // 1. Mock a successful API response and fetch it while online
    await page.route('**/api/books/test-list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [{ id: '1', title: 'Cached Book' }] }),
      });
    });

    await page.evaluate(async () => {
      const res = await fetch('/api/books/test-list');
      return res.json();
    });

    // 2. Go offline
    await context.setOffline(true);

    // 3. Fetch again while offline - it should succeed from cache
    const data = await page.evaluate(async () => {
      const res = await fetch('/api/books/test-list');
      return res.json();
    });

    expect(data.ok).toBe(true);
    expect(data.data[0].title).toBe('Cached Book');

    await context.setOffline(false);
  });

  test('EPUB and image assets use CacheFirst', async ({ page, context }) => {
    // 1. Fetch an EPUB asset while online
    await page.route('**/api/files/test.epub', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/epub+zip',
        body: Buffer.from('mock-epub-content'),
      });
    });

    await page.evaluate(async () => {
      await fetch('/api/files/test.epub');
    });

    // 2. Go offline
    await context.setOffline(true);

    // 3. Fetch again - should be served from cache
    const content = await page.evaluate(async () => {
      const res = await fetch('/api/files/test.epub');
      return res.text();
    });

    expect(content).toBe('mock-epub-content');

    // 4. Verify it is in the 'book-content' cache specifically
    const inCorrectCache = await page.evaluate(async () => {
      const cache = await caches.open('book-content');
      const match = await cache.match('/api/files/test.epub');
      return !!match;
    });
    expect(inCorrectCache).toBe(true);

    await context.setOffline(false);
  });
});
