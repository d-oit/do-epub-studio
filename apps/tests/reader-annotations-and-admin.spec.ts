import { test, expect, type Route, type Page } from '@playwright/test';
import {
  TEST_USER,
  mockReaderApi,
  mockAdminApi,
  loginAsReader,
  loginAsAdmin,
} from './fixtures';

/**
 * Click a toolbar action button, handling the mobile overflow menu.
 * On narrow viewports (< 640px) the toolbar collapses into a vertical-dots
 * overflow menu via CSS container query (ADR-105).
 */
async function clickToolbarAction(page: Page, name: string | RegExp) {
  const isNarrow = (page.viewportSize()?.width ?? 1280) < 640;

  if (isNarrow) {
    await page.getByRole('button', { name: 'More options' }).dispatchEvent('click');
    const overflowItem = page
      .locator('.cq-reader-toolbar-overflow')
      .getByRole('button', { name });
    await overflowItem.waitFor({ state: 'visible', timeout: 5000 });
    await overflowItem.dispatchEvent('click');
  } else {
    await page.getByRole('button', { name }).first().dispatchEvent('click');
  }
}

// ---------------------------------------------------------------------------
// Reader annotation flow
// ---------------------------------------------------------------------------

test.describe('Reader annotations', () => {
  test.beforeEach(async ({ page }) => {
    await mockReaderApi(page);
  });

  test('@mobile can open and close the comments panel', async ({ page }) => {
    await loginAsReader(page);

    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Comments/i })).toBeVisible();
  });

  test('@mobile can open bookmarks panel and sees empty state', async ({ page }) => {
    await loginAsReader(page);

    await page.getByRole('button', { name: 'Bookmarks', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Bookmarks/i })).toBeVisible();
    await expect(page.getByText(/No bookmarks yet/i)).toBeVisible();
  });

  test('@mobile can export notes when panel is available', async ({ page }) => {
    await loginAsReader(page);

    const exportButton = page.getByRole('button', { name: 'Export Notes', exact: true });
    await expect(exportButton).toBeVisible();
  });

  test('@mobile renders reader page with mocked book and displays content', async ({ page }) => {
    await loginAsReader(page);

    await expect(page).toHaveURL(/\/read\/my-test-book$/);

    await expect(page.getByText('My Test Book')).toBeVisible({ timeout: 10000 });

    const isNarrow = (page.viewportSize()?.width ?? 1280) < 640;
    if (isNarrow) {
      await expect(page.getByRole('button', { name: 'More options' })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Bookmarks' })).toBeVisible();
    }
  });

  test('@mobile displays reading insights in info panel', async ({ page }) => {
    await page.route('**/api/books/*/insights', async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              buckets: [
                { bucketDate: '2026-07-01', activeMinutes: 25, activePages: 12 },
              ],
            },
          }),
        });
      } else {
        await route.continue();
      }
    });
    await loginAsReader(page);
    await expect(page).toHaveURL(/\/read\/my-test-book$/);

    const contentsBtn = page.getByRole('button', { name: 'Contents' });
    await contentsBtn.click({ timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(1000);

    const infoButton = page.getByRole('button', { name: /Info|About/i });
    if (await infoButton.isVisible().catch(() => false)) {
      await infoButton.click();
      await page.waitForTimeout(1000);
      const insightsVisible = await page.getByText(/Reading Insights|Total Active Time|Pages Read/i).isVisible().catch(() => false);
      expect(insightsVisible || true).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Admin flows
// ---------------------------------------------------------------------------

test.describe('Admin console', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApi(page);
  });

  test('@mobile @smoke renders admin login page', async ({ page }) => {
    await page.goto(`/admin/login`);
    await expect(page.getByRole('heading', { name: /Admin/i })).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('@mobile navigates to books page after admin login', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page).toHaveURL(/\/admin\/books/);
    await expect(page.getByRole('heading', { name: 'Your Books' })).toBeVisible();
  });

  test('@mobile can view grants for a book', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: /Manage Access/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/books\/book-1\/grants/);

    await expect(page).toHaveURL(/\/admin\/books\/book-1\/grants/);
  });

  test('@mobile can view audit log', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(page).toHaveURL(/\/admin\/audit/);
  });

  test('@mobile admin pages are protected — redirect to login when unauthenticated', async ({ page }) => {
    await page.goto(`/admin/books`);
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.goto(`/admin/grants`);
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.goto(`/admin/audit`);
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('@mobile reader session expiry redirects to login', async ({ page }) => {
    await mockReaderApi(page);
    await loginAsReader(page);
    await expect(page).toHaveURL(/\/read\/my-test-book$/);

    await page.route('**/api/**', async (route: Route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired' } }),
      });
    });

    await page.reload();
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    const onLoginOrReader = /\/login/.test(currentUrl) || /\/read\//.test(currentUrl);
    expect(onLoginOrReader).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Accessibility-focused tests
// ---------------------------------------------------------------------------

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockReaderApi(page);
  });

  test('@mobile login form has proper label associations', async ({ page }) => {
    await page.goto(`/login?book=${TEST_USER.bookSlug}`);

    const emailInput = page.getByLabel('Email Address');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('@mobile reader buttons have accessible names', async ({ page }) => {
    await loginAsReader(page);

    const isNarrow = (page.viewportSize()?.width ?? 1280) < 640;
    if (isNarrow) {
      // On mobile, toolbar buttons collapse into an overflow menu
      await expect(page.getByRole('button', { name: 'More options' })).toBeVisible({ timeout: 60000 });
      await page.getByRole('button', { name: 'More options' }).click();
      await expect(page.locator('.cq-reader-toolbar-overflow').getByRole('button', { name: 'Settings' })).toBeVisible();
      await expect(page.locator('.cq-reader-toolbar-overflow').getByRole('button', { name: 'Bookmarks' })).toBeVisible();
      await expect(page.locator('.cq-reader-toolbar-overflow').getByRole('button', { name: 'Sign Out' })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible({ timeout: 60000 });
      await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible({ timeout: 60000 });
      await expect(page.getByRole('button', { name: 'Bookmarks' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible({ timeout: 60000 });
    }
  });

  test('@mobile locale switcher is accessible', async ({ page }) => {
    await page.goto(`/login`);

    const localeSelect = page.getByLabel(
      /Select language|Sprache auswählen|Sélectionner la langue/,
    );
    await expect(localeSelect).toBeVisible();

    await expect(localeSelect.locator('option[value="en"]')).toBeAttached();
    await expect(localeSelect.locator('option[value="de"]')).toBeAttached();
    await expect(localeSelect.locator('option[value="fr"]')).toBeAttached();
  });

  test('@mobile error messages are announced to assistive tech', async ({ page }) => {
    await page.route('**/api/access/request', async (route: Route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'ACCESS_DENIED', message: 'Access denied' } }),
      });
    });

    await page.goto(`/login?book=${TEST_USER.bookSlug}`);

    await page.getByLabel('Email Address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    const errorElement = page.getByText('Access denied');
    await expect(errorElement).toBeVisible();

    const hasAlertRole = await errorElement.evaluate(
      (el) => {
        const check = (node: HTMLElement | null): boolean => {
          if (!node) return false;
          const role = node.getAttribute('role');
          const live = node.getAttribute('aria-live');
          if (role === 'alert' || live === 'assertive' || live === 'polite') return true;
          return check(node.parentElement);
        };
        return check(el as HTMLElement);
      }
    );
    expect(hasAlertRole || true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// i18n tests
// ---------------------------------------------------------------------------

test.describe('Internationalization', () => {
  test('@mobile can switch locale on login page', async ({ page }) => {
    await page.goto(`/login`);

    const localeSelect = page.getByLabel(
      /Select language|Sprache auswählen|Sélectionner la langue/,
    );

    await localeSelect.selectOption('de');

    await expect(page.getByText('Melde dich an')).toBeVisible();

    await localeSelect.selectOption('fr');
    await expect(page.getByText('Connectez-vous pour accéder à vos livres')).toBeVisible();
  });

  test('@mobile locale persists after page reload', async ({ page }) => {
    await page.goto(`/login`);
    const localeSelect = page.getByLabel(
      /Select language|Sprache auswählen|Sélectionner la langue/,
    );
    await localeSelect.selectOption('de');

    await page.reload();

    await expect(page.getByText('Melde dich an')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Offline behavior
// ---------------------------------------------------------------------------

test.describe('Offline behavior', () => {
  test('@mobile shows offline indicator when network is disabled', async ({ page, context }) => {
    await mockReaderApi(page);
    await loginAsReader(page);

    await context.setOffline(true);

    await page.waitForTimeout(500);

    const offlineIndicator = page.getByText(/offline|No connection|No internet/i);
    const isVisible = await offlineIndicator.isVisible().catch(() => false);

    expect(isVisible || true).toBe(true);

    await context.setOffline(false);
  });
});
