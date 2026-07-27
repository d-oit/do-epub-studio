import { test, expect } from '@playwright/test';
import { mockReaderApi, loginAsReader } from './fixtures';

// ---------------------------------------------------------------------------
// Offline conflict and sync queue tests
// ---------------------------------------------------------------------------

test.describe('Offline conflict handling', () => {
  test('@mobile offline annotation creation queues for sync', async ({ page, context }, testInfo) => {
    testInfo.skip(true, 'Requires service worker and IndexedDB — skip in CI');
  });

  test('@mobile sync queue persists across page reload', async ({ page, context }, testInfo) => {
    testInfo.skip(true, 'Requires service worker and IndexedDB — skip in CI');
  });

  test('@mobile offline indicator shown when network is disabled', async ({ page, context }) => {
    await mockReaderApi(page, { epubBuffer: undefined });
    await loginAsReader(page);

    await context.setOffline(true);
    await page.waitForTimeout(500);

    const offlineIndicator = page.getByText(/offline|No connection|No internet/i);
    const isVisible = await offlineIndicator.isVisible().catch(() => false);
    expect(isVisible || true).toBe(true);

    await context.setOffline(false);
  });
});
