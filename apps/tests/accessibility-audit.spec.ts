import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockReaderApi, mockAdminApi, loginAsReader, loginAsAdmin, clickToolbarButton, suppressWorkboxErrors } from './fixtures';

// ---------------------------------------------------------------------------
// Axe-core accessibility audit tests
// ---------------------------------------------------------------------------

test.describe('Accessibility audit (axe-core)', () => {
  test('@mobile login page has no critical accessibility violations', async ({ page }) => {
    await page.goto(`/login`);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
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

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
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
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toHaveLength(0);
  });

  test('@mobile reader TOC panel has no accessibility violations', async ({ page }) => {
    await mockReaderApi(page, { includeBookmarks: false });
    await loginAsReader(page);

    await page.getByLabel('Contents').click();
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toHaveLength(0);
  });

  test('@mobile keyboard navigation: can close panels with Escape', async ({ page }) => {
    suppressWorkboxErrors(page);
    await mockReaderApi(page, { includeBookmarks: false });
    await loginAsReader(page);

    // Open Settings
    await clickToolbarButton(page, /Settings/i);
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog').getByText('Settings', { exact: true })).not.toBeVisible();

    // Open TOC
    await page.getByLabel('Contents').click();
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Contents' })).not.toBeVisible();
  });

  test('@mobile admin login page has no critical accessibility violations', async ({ page }) => {
    await page.goto(`/admin/login`);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
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

  test('@mobile admin books list page has no critical accessibility violations', async ({ page }) => {
    await mockAdminApi(page);
    await loginAsAdmin(page);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations (admin books):', JSON.stringify(accessibilityScanResults.violations, null, 2));
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
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations (admin grants):', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalViolations).toHaveLength(0);
  });

  test('@mobile admin audit log page has no critical accessibility violations', async ({ page }) => {
    await mockAdminApi(page);
    await loginAsAdmin(page);
    await page.goto('/admin/audit');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Axe violations (admin audit):', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalViolations).toHaveLength(0);
  });
});
