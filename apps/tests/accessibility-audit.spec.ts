import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  mockReaderApi,
  mockAdminApi,
  loginAsReader,
  loginAsAdmin,
  clickToolbarButton,
  suppressWorkboxErrors,
  EPUB_CONTENT_HOST_SELECTOR,
} from './fixtures';

// ---------------------------------------------------------------------------
// Axe-core accessibility audit tests
// ---------------------------------------------------------------------------

test.describe('Accessibility audit (axe-core)', () => {
  test('@mobile login page has no critical accessibility violations', async ({ page }) => {
    await page.goto(`/login`);
    // Scan the rendered page, not the pre-hydration shell: a scan that fires
    // before React mounts measures a page that does not exist yet and reports
    // zero violations for it (the vacuous-pass class E1 removed elsewhere).
    await expect(page.getByRole('textbox', { name: /Password/i }).first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
    });
    await page.waitForTimeout(200);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations:', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(criticalViolations).toHaveLength(0);
    expect(accessibilityScanResults.violations).toHaveLength(0);
  });

  test('@mobile reader page has no critical accessibility violations', async ({ page }) => {
    await mockReaderApi(page, { includeBookmarks: false });
    await loginAsReader(page);

    // The exclusion below keeps the scripts-disabled sandbox out of axe's
    // frame traversal (docs/accessibility.md). The `<iframe>` element itself
    // IS auditable from this document — `frame-title` needs no scripts inside
    // the frame — so its accessible name is asserted directly rather than
    // silently dropped with the subtree. The frame appears once the EPUB has
    // rendered, which under parallel load outlives the toolbar wait.
    const bookFrame = page.locator(`${EPUB_CONTENT_HOST_SELECTOR} iframe`).first();
    await expect(bookFrame).toBeAttached({ timeout: 30_000 });
    await expect(bookFrame).toHaveAttribute('title', /\S/, { timeout: 20_000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .exclude(EPUB_CONTENT_HOST_SELECTOR)
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations:', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test('@mobile reader settings panel has no accessibility violations', async ({ page }) => {
    suppressWorkboxErrors(page);
    await mockReaderApi(page, { includeBookmarks: false });
    await loginAsReader(page);

    await clickToolbarButton(page, /Settings/i);
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .exclude(EPUB_CONTENT_HOST_SELECTOR)
      .analyze();

    expect(accessibilityScanResults.violations).toHaveLength(0);
  });

  test('@mobile reader TOC panel has no accessibility violations', async ({ page }) => {
    await mockReaderApi(page, { includeBookmarks: false });
    await loginAsReader(page);

    await page.getByLabel('Contents').click();
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .exclude(EPUB_CONTENT_HOST_SELECTOR)
      .analyze();

    expect(accessibilityScanResults.violations).toHaveLength(0);
  });

  test('@mobile keyboard navigation restores focus after reader dialogs and panels close', async ({
    page,
  }) => {
    suppressWorkboxErrors(page);
    await mockReaderApi(page, { includeBookmarks: false });
    await loginAsReader(page);

    const settingsTrigger = page.getByRole('button', { name: /Settings/i });
    await settingsTrigger.focus();
    await page.keyboard.press('Enter');
    const settingsDialog = page.getByRole('dialog');
    await expect(settingsDialog).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(settingsDialog.locator(':focus')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(settingsDialog).not.toBeVisible();
    await expect(settingsTrigger).toBeFocused();

    const contentsTrigger = page.getByLabel('Contents');
    await contentsTrigger.focus();
    await page.keyboard.press('Enter');
    const contentsPanel = page.getByRole('heading', { name: 'Contents' });
    await expect(contentsPanel).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(contentsPanel).not.toBeVisible();
    await expect(contentsTrigger).toBeFocused();
  });

  test('@mobile creator workspace has no accessibility violations', async ({ page }) => {
    suppressWorkboxErrors(page);
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'do-epub-auth',
        JSON.stringify({
          state: {
            sessionToken: 'creator-session-token',
            sessionExpiresAt: Date.now() + 86400000,
            bookId: 'book-1',
            bookSlug: 'test-book',
            bookTitle: 'Test Book',
            email: 'creator@example.com',
            capabilities: {
              canRead: true,
              canComment: true,
              canHighlight: true,
              canBookmark: true,
              canDownloadOffline: true,
              canExportNotes: true,
              canManageAccess: false,
            },
            isAuthenticated: true,
            isAdmin: false,
            sessionExpired: false,
          },
          version: 0,
        }),
      );
    });
    await page.route('**/api/creator/books', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: [{ id: 'book-1', slug: 'test-book', title: 'The Great Creator Novel' }],
        }),
      });
    });
    await page.goto('/creator');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('The Great Creator Novel')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toHaveLength(0);
  });

  test('@mobile admin login page has no critical accessibility violations', async ({ page }) => {
    await page.goto(`/admin/login`);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations:', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(criticalViolations).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Admin pages (C2 — axe-core audits for admin pages)
  // -------------------------------------------------------------------------

  test('@mobile admin books list page has no critical accessibility violations', async ({
    page,
  }) => {
    await mockAdminApi(page);
    await loginAsAdmin(page);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log(
        'Axe violations (admin books):',
        JSON.stringify(accessibilityScanResults.violations, null, 2),
      );
    }

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalViolations).toHaveLength(0);
  });

  test('@mobile admin grants page has no critical accessibility violations', async ({ page }) => {
    await mockAdminApi(page);
    await loginAsAdmin(page);
    await page.goto('/admin/grants');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
    });
    await page.waitForTimeout(200);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log(
        'Axe violations (admin grants):',
        JSON.stringify(accessibilityScanResults.violations, null, 2),
      );
    }

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalViolations).toHaveLength(0);
  });

  test('@mobile admin audit log page has no critical accessibility violations', async ({
    page,
  }) => {
    await mockAdminApi(page);
    await loginAsAdmin(page);
    await page.goto('/admin/audit');
    // Same contract as the grants audit above: scan the populated page, never
    // an empty table whose rows (and their status pills) have not loaded yet.
    await expect(page.getByRole('table').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
    });
    await page.waitForTimeout(200);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log(
        'Axe violations (admin audit):',
        JSON.stringify(accessibilityScanResults.violations, null, 2),
      );
    }

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalViolations).toHaveLength(0);
  });
});
