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

    const isNarrow = (page.viewportSize()?.width ?? 1280) < 640;
    if (isNarrow) {
      const moreBtn = page.getByRole('button', { name: /More [Oo]ptions/i });
      await expect(moreBtn).toBeVisible({ timeout: 20000 });
      await moreBtn.focus();
      await expect(moreBtn).toBeFocused();
      await moreBtn.click();
      const settingsMenuItem = page.locator('.cq-reader-toolbar-overflow').getByRole('menuitem', { name: /Settings/i });
      await expect(settingsMenuItem).toBeVisible();
      await settingsMenuItem.focus();
      await expect(settingsMenuItem).toBeFocused();
      await settingsMenuItem.click();
    } else {
      const settingsBtn = page.getByRole('button', { name: /Settings/i });
      await expect(settingsBtn).toBeVisible({ timeout: 20000 });
      await settingsBtn.focus();
      await expect(settingsBtn).toBeFocused();
      await settingsBtn.click();
    }

    const dialog = page.getByRole('dialog').getByText('Settings', { exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // Focus must return to an interactive trigger element inside the toolbar
    const focusedInfo = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName.toLowerCase(),
        role: el?.getAttribute('role'),
        isInsideToolbar: Boolean(el?.closest('[data-container-name="reader-toolbar"]')),
      };
    });
    expect(focusedInfo.isInsideToolbar, 'Focus must return to the toolbar trigger').toBe(true);
    expect(['button', 'menuitem']).toContain(focusedInfo.role ?? focusedInfo.tag);
  });
});

test.describe('Advanced accessibility — ARIA landmarks', () => {
  test('@mobile login page has proper ARIA landmarks', async ({ page }) => {
    await page.goto('/login');
    const mainLandmark = page.locator('main, [role="main"]');
    const navLandmark = page.locator('nav, [role="navigation"]');
    // Wait for the SPA to hydrate before counting: the app renders <main>
    // synchronously on mount, so counting immediately after goto races
    // React hydration on slow CI runners (issue #957 — flaky scheduled E2E).
    await expect(mainLandmark.or(navLandmark).first()).toBeAttached({ timeout: 30_000 });
    const hasMain = await mainLandmark.count().catch(() => 0);
    const hasNav = await navLandmark.count().catch(() => 0);
    expect(hasMain + hasNav).toBeGreaterThanOrEqual(1);
  });

  test('@mobile admin books page has proper landmarks', async ({ page }) => {
    await mockAdminApi(page);
    await loginAsAdmin(page);
    const mainLandmark = page.locator('main, [role="main"]');
    // Same hydration race as the login-page test: the admin route is
    // lazy-loaded, so count only after the landmark attaches.
    await expect(mainLandmark.first()).toBeAttached({ timeout: 30_000 });
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

    // Verify initial focus is placed inside the dialog
    const initialFocusInside = await page.evaluate(() => {
      const dialogEl = document.querySelector('[role="dialog"]');
      return Boolean(dialogEl?.contains(document.activeElement));
    });
    expect(initialFocusInside, 'Initial focus must be placed inside the dialog').toBe(true);

    // Shift+Tab from the first focusable element must wrap and stay inside the dialog
    await page.keyboard.press('Shift+Tab');
    const wrappedToLast = await page.evaluate(() => {
      const dialogEl = document.querySelector('[role="dialog"]');
      return Boolean(dialogEl?.contains(document.activeElement));
    });
    expect(wrappedToLast, 'Shift+Tab must keep focus trapped inside the dialog').toBe(true);

    // Tab forward must wrap back and stay inside the dialog
    await page.keyboard.press('Tab');
    const wrappedToFirst = await page.evaluate(() => {
      const dialogEl = document.querySelector('[role="dialog"]');
      return Boolean(dialogEl?.contains(document.activeElement));
    });
    expect(wrappedToFirst, 'Tab must keep focus trapped inside the dialog').toBe(true);
  });

  test('@mobile settings panel has axe-core violations audit', async ({ page }) => {
    suppressWorkboxErrors(page);
    await loginAsReader(page);
    await clickToolbarButton(page, /Settings/i);
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });
});
