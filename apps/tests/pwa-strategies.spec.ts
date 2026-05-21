import { test, expect } from '@playwright/test';

test.describe('PWA Offline Strategies', () => {
  test('serves app shell (index.html) when offline for navigation routes', async ({ page, context }) => {
    // 1. Visit the app online to ensure service worker and assets are cached
    await page.goto('/');

    // Wait for service worker to be ready
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return !!registration;
    });

    // 2. Go offline
    await context.setOffline(true);

    // 3. Attempt to navigate to a non-precached route (e.g., /read/some-slug)
    // The service worker should handle this via NavigationRoute and return the precached index.html
    await page.goto('/read/offline-test-slug');

    // 4. Verify that the app shell is loaded (index.html contains root div)
    const root = page.locator('#root');
    await expect(root).toBeVisible({ timeout: 10000 });

    // Verify we are still on the intended URL (it didn't just fail to load)
    expect(page.url()).toContain('/read/offline-test-slug');

    // 5. Verify that sensitive API routes are NOT cached (NetworkOnly)
    // We try to fetch a sensitive route while offline - it should fail
    const isNetworkOnlyFailed = await page.evaluate(async () => {
      try {
        await fetch('/api/access/validate?bookId=test');
        return false;
      } catch (e) {
        return true;
      }
    });
    expect(isNetworkOnlyFailed).toBe(true);

    // 6. Restore network
    await context.setOffline(false);
  });
});
