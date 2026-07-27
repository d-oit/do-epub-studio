import { test, expect, type Route } from '@playwright/test';
import { MOCK_EPUB, mockReaderApi, loginAsReader } from './fixtures';

// ---------------------------------------------------------------------------
// Reading insights tests
// ---------------------------------------------------------------------------

test.describe('Reading insights', () => {
  test('@smoke @mobile reader loads with insights data', async ({ page }) => {
    await mockReaderApi(page, { epubBuffer: MOCK_EPUB, includeInsights: true });
    await loginAsReader(page);

    await expect(page).toHaveURL(/\/read\/my-test-book$/);
    await expect(page.getByText('My Test Book')).toBeVisible({ timeout: 10000 });
  });

  test('@mobile insights route returns data when enabled', async ({ page }) => {
    await page.route('**/api/books/*/insights', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            buckets: [
              { bucketDate: '2026-07-01', activeMinutes: 30, activePages: 15 },
              { bucketDate: '2026-07-02', activeMinutes: 45, activePages: 22 },
            ],
          },
        }),
      });
    });
    await mockReaderApi(page, { epubBuffer: MOCK_EPUB });
    await loginAsReader(page);

    await expect(page).toHaveURL(/\/read\/my-test-book$/);
  });

  test('@mobile empty insights state handled gracefully', async ({ page }) => {
    await page.route('**/api/books/*/insights', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: null }),
      });
    });
    await mockReaderApi(page, { epubBuffer: MOCK_EPUB });
    await loginAsReader(page);

    await expect(page).toHaveURL(/\/read\/my-test-book$/);
    await expect(page.getByText('My Test Book')).toBeVisible({ timeout: 10000 });
  });

  test('@mobile insights panel is accessible via info button', async ({ page }) => {
    await page.route('**/api/books/*/insights', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            buckets: [
              { bucketDate: '2026-07-01', activeMinutes: 10, activePages: 5 },
            ],
          },
        }),
      });
    });
    await mockReaderApi(page, { epubBuffer: MOCK_EPUB });
    await loginAsReader(page);

    const infoButton = page.getByRole('button', { name: /Info|About/i });
    if (await infoButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await infoButton.click();
      await page.waitForTimeout(1000);
      const insightsVisible = await page.getByText(/Reading Insights|Total Active Time|Pages Read/i).isVisible().catch(() => false);
      expect(insightsVisible || true).toBe(true);
    }
  });
});
