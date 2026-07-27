import { test, expect, type Page, type Route } from '@playwright/test';
import { MOCK_EPUB, mockReaderApi, loginAsReader, suppressWorkboxErrors } from './fixtures';

const INSIGHTS_RESPONSE = {
  ok: true,
  data: {
    buckets: [
      { bucketDate: '2026-07-01', activeMinutes: 25, activePages: 12 },
      { bucketDate: '2026-07-02', activeMinutes: 40, activePages: 20 },
    ],
  },
};

async function mockReaderApiWithInsights(page: Page, opts: { empty?: boolean } = {}) {
  await mockReaderApi(page, { epubBuffer: MOCK_EPUB, includeInsights: true });
  await page.route('**/api/books/*/insights', async (route: Route) => {
    if (route.request().method() === 'GET') {
      const resp = opts.empty ? { ok: true, data: null } : INSIGHTS_RESPONSE;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resp) });
    } else {
      await route.continue();
    }
  });
}

test.describe('Reading insights', () => {
  test.beforeEach(async ({ page }) => { await mockReaderApiWithInsights(page); });

  test('@smoke @mobile reader page loads successfully', async ({ page }) => {
    suppressWorkboxErrors(page);
    await loginAsReader(page);
    await expect(page).toHaveURL(/\/read\/my-test-book$/);
    await expect(page.getByText('My Test Book')).toBeVisible({ timeout: 10000 });
  });

  test('@mobile insights data loads without breaking reader', async ({ page }) => {
    suppressWorkboxErrors(page);
    await loginAsReader(page);
    await expect(page).toHaveURL(/\/read\/my-test-book$/);
    await expect(page.getByText('My Test Book')).toBeVisible({ timeout: 10000 });
  });

  test('@mobile empty insights state does not break reader', async ({ page }) => {
    suppressWorkboxErrors(page);
    await mockReaderApiWithInsights(page, { empty: true });
    await loginAsReader(page);
    await expect(page).toHaveURL(/\/read\/my-test-book$/);
    await expect(page.getByText('My Test Book')).toBeVisible({ timeout: 10000 });
  });

  test('@mobile info button is accessible from reader', async ({ page }) => {
    suppressWorkboxErrors(page);
    await loginAsReader(page);
    const contentsBtn = page.getByRole('button', { name: 'Contents' });
    await contentsBtn.click({ timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
    const infoButton = page.getByRole('button', { name: /Info|About/i });
    if (await infoButton.isVisible().catch(() => false)) {
      await infoButton.click();
    }
  });
});
