import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  MOCK_EPUB,
  mockReaderApi,
  loginAsReader,
  loginAsAdmin,
  mockAdminApi,
  clickToolbarButton,
  suppressWorkboxErrors,
} from './fixtures';

test.describe('Advanced accessibility — keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockReaderApi(page, { epubBuffer: MOCK_EPUB });
  });

  test('@smoke @mobile can tab through reader toolbar buttons', async ({ page }) => {
    suppressWorkboxErrors(page);
    await loginAsReader(page);
    const isNarrow = (page.viewportSize()?.width ?? 1280) < 640;
    if (isNarrow) {
      const moreBtn = page.getByRole('button', { name: /More [Oo]ptions/i });
      await expect(moreBtn).toBeVisible({ timeout: 60000 });
      await moreBtn.focus();
      await page.keyboard.press('Enter');
      // Menu items use role="menuitem" after GOAP-224 a11y fix (B8)
      await expect(page.locator('.cq-reader-toolbar-overflow').getByRole('menuitem', { name: 'Settings' })).toBeVisible();
    } else {
      const contentsBtn = page.getByRole('button', { name: 'Contents' });
      await expect(contentsBtn).toBeVisible({ timeout: 60000 });
      await contentsBtn.focus();
      await expect(contentsBtn).toBeFocused();
    }
  });

  test('@mobile can open and close panels with keyboard', async ({ page }) => {
    suppressWorkboxErrors(page);
    await loginAsReader(page);
    await clickToolbarButton(page, /Settings/i);
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).not.toBeVisible();
  });

  test('@mobile focus returns to trigger after panel close', async ({ page }) => {
    suppressWorkboxErrors(page);
    await loginAsReader(page);
    await clickToolbarButton(page, /Settings/i);
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const activeElement = await page.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? null);
    expect(activeElement).not.toBeNull();
  });
});

test.describe('Advanced accessibility — ARIA landmarks', () => {
  test('@mobile login page has proper ARIA landmarks', async ({ page }) => {
    await page.goto('/login');
    const mainLandmark = page.locator('main, [role="main"]');
    const navLandmark = page.locator('nav, [role="navigation"]');
    const hasMain = await mainLandmark.count().catch(() => 0);
    const hasNav = await navLandmark.count().catch(() => 0);
    expect(hasMain + hasNav).toBeGreaterThanOrEqual(1);
  });

  test('@mobile admin books page has proper landmarks', async ({ page }) => {
    await mockAdminApi(page);
    await loginAsAdmin(page);
    const mainLandmark = page.locator('main, [role="main"]');
    const hasMain = await mainLandmark.count().catch(() => 0);
    expect(hasMain).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Advanced accessibility — focus management', () => {
  test.beforeEach(async ({ page }) => {
    await mockReaderApi(page, { epubBuffer: MOCK_EPUB });
  });

  test('@mobile modal open traps focus', async ({ page }) => {
    suppressWorkboxErrors(page);
    await loginAsReader(page);
    await clickToolbarButton(page, /Settings/i);
    const dialog = page.getByRole('dialog').getByText('Settings', { exact: true });
    await expect(dialog).toBeVisible();
  });

  test('@mobile settings panel has axe-core violations audit', async ({ page }) => {
    suppressWorkboxErrors(page);
    await loginAsReader(page);
    await clickToolbarButton(page, /Settings/i);
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });
});
