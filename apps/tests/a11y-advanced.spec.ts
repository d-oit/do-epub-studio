import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TEST_USER, MOCK_EPUB, mockReaderApi, loginAsReader, clickToolbarButton, suppressWorkboxErrors } from './fixtures';

// ---------------------------------------------------------------------------
// Advanced accessibility tests
// ---------------------------------------------------------------------------

test.describe('Advanced accessibility', () => {
  test('@smoke @mobile keyboard navigation through reader toolbar', async ({ page }) => {
    suppressWorkboxErrors(page);
    await mockReaderApi(page, { epubBuffer: MOCK_EPUB });
    await loginAsReader(page);

    const isNarrow = (page.viewportSize()?.width ?? 1280) < 640;
    if (isNarrow) {
      const moreBtn = page.getByRole('button', { name: /More [Oo]ptions/i });
      await moreBtn.waitFor({ state: 'visible', timeout: 10000 });
      await moreBtn.click();
      await page.waitForTimeout(200);
    }

    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test('@mobile panel open and close with keyboard', async ({ page }) => {
    suppressWorkboxErrors(page);
    await mockReaderApi(page, { epubBuffer: MOCK_EPUB });
    await loginAsReader(page);

    await clickToolbarButton(page, /Settings/i);
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).not.toBeVisible();
  });

  test('@mobile focus management after panel close', async ({ page }) => {
    suppressWorkboxErrors(page);
    await mockReaderApi(page, { epubBuffer: MOCK_EPUB });
    await loginAsReader(page);

    await page.getByLabel('Contents').click();
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Contents' })).not.toBeVisible();

    const activeTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeTag).toBeTruthy();
  });

  test('@mobile login page has ARIA landmarks', async ({ page }) => {
    await page.goto(`/login?book=${TEST_USER.bookSlug}`);

    const hasMain = await page.locator('main, [role="main"]').count();
    const hasBanner = await page.locator('header, [role="banner"]').count();
    const hasForm = await page.locator('form').count();

    expect(hasMain + hasBanner + hasForm).toBeGreaterThan(0);
  });

  test('@mobile settings panel has no axe violations', async ({ page }) => {
    suppressWorkboxErrors(page);
    await mockReaderApi(page, { epubBuffer: MOCK_EPUB });
    await loginAsReader(page);

    await clickToolbarButton(page, /Settings/i);
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });

  test('@mobile login page has no axe violations', async ({ page }) => {
    await page.goto(`/login`);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });
});
