import { test, expect } from '@playwright/test';

test.describe('PWA Caching Strategies', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Visit the app online to install the worker (cold precache on
    //    first visit takes a while — do not reload mid-install).
    await page.goto('/', { waitUntil: 'networkidle' });
    const activated = await page.evaluate(async () => {
      try {
        await Promise.race([
          navigator.serviceWorker.ready.then(() => undefined),
          new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 60000)),
        ]);
        return true;
      } catch {
        return false;
      }
    });
    expect(activated, 'Service Worker must install and activate in pwa-chromium').toBe(true);

    // 2. Reload under the activated worker for control: registerType
    //    'prompt' ships no clients.claim, so first-load pages stay
    //    uncontrolled. Missing control after reload is a failure,
    //    never a skip (E2E-02).
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
    expect(controlled, 'Service Worker must be active and controlling the page in pwa-chromium').toBe(true);
  });

  test('@mobile @pwa @pwa Navigation requests return index.html from cache when offline', async ({ page, context }) => {
    // Go offline, then navigate to a public route: the SW navigation route
    // must serve the cached app shell instead of a browser error page.
    // (/read/* would redirect a guest to /login via the auth guard — that
    // redirect is app-correct behavior, not a SW failure — so use /help.)
    await context.setOffline(true);

    await page.goto('/help');

    // Verify that the app shell is loaded (index.html contains root div)
    const root = page.locator('#root');
    await expect(root).toBeVisible({ timeout: 10000 });

    // Verify the URL remains the one we navigated to
    expect(page.url()).toContain('/help');

    await context.setOffline(false);
  });

  test('@mobile @pwa @pwa Sensitive API routes use NetworkOnly and are never cached', async ({ page, context }) => {
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

  test('@mobile @pwa Generic API requests use NetworkFirst (cached for offline)', async ({ page, context }) => {
    // Seed the strategy cache directly: with a controlling SW, page.route
    // mocks are bypassed (the SW fetches from its own context), so seed the
    // real 'api-responses' cache that the NetworkFirst route in sw.ts reads.
    await page.evaluate(async () => {
      const cache = await caches.open('api-responses');
      await cache.put(
        '/api/books/test-list',
        new Response(JSON.stringify({ ok: true, data: [{ id: '1', title: 'Cached Book' }] }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    // Go offline
    await context.setOffline(true);

    // Fetch while offline - it should succeed from cache
    const data = await page.evaluate(async () => {
      const res = await fetch('/api/books/test-list');
      return (await res.json()) as { ok: boolean; data: { title: string }[] };
    });

    expect(data.ok).toBe(true);
    expect(data.data[0].title).toBe('Cached Book');

    await context.setOffline(false);
  });

  test('@mobile @pwa EPUB and image assets use CacheFirst', async ({ page, context }) => {
    // Seed the strategy cache directly (see NetworkFirst test above for
    // why page.route cannot mock SW-observed traffic).
    await page.evaluate(async () => {
      const cache = await caches.open('book-content');
      await cache.put(
        '/api/files/test.epub',
        new Response('mock-epub-content', { headers: { 'Content-Type': 'application/epub+zip' } }),
      );
    });

    // Go offline
    await context.setOffline(true);

    // Fetch - should be served from cache
    const content = await page.evaluate(async () => {
      const res = await fetch('/api/files/test.epub');
      return res.text();
    });

    expect(content).toBe('mock-epub-content');

    // Verify it is in the 'book-content' cache specifically
    const inCorrectCache = await page.evaluate(async () => {
      const cache = await caches.open('book-content');
      const match = await cache.match('/api/files/test.epub');
      return !!match;
    });
    expect(inCorrectCache).toBe(true);

    await context.setOffline(false);
  });
});

// Hard assertion (no skip) that the service worker registers and activates.
// A prior version of the beforeEach above SKIPPED when the SW was
// unavailable, which hid the production regression where `sw.js` was built
// as an ES module but registered as a classic worker ("Cannot use
// 'import.meta' outside a module" → sw.registration_failed). Both the
// registration test and the strategy tests above FAIL loudly if the SW
// ever stops registering or controlling, so the PWA layer cannot silently
// rot again.
test.describe('Service Worker Registration (production)', () => {
  test('@pwa service worker registers and activates', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const reg = await page.evaluate(async () => {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Service worker never became ready — registration failed')),
            30_000,
          ),
        ),
      ]);
      return {
        active: Boolean(registration.active),
        scriptURL: registration.active?.scriptURL ?? null,
        scope: registration.scope,
      };
    });

    expect(reg.active).toBe(true);
    expect(reg.scriptURL).toMatch(/\/sw\.js$/);
    expect(reg.scope).toBe(new URL('/', page.url()).href);
  });
});
