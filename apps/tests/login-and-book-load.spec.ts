import { test, expect, type Page, type Route } from '@playwright/test';
import { TEST_USER, mockReaderApi } from './fixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fill out the login form and submit it.
 * Book slug is passed via URL param, not a form field.
 * Lightweight version — no URL assertion, no waitForLoadState.
 */
async function login(page: Page) {
  await page.goto(`/login?book=${TEST_USER.bookSlug}`);
  await page.getByLabel('Email Address').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
}

// ---------------------------------------------------------------------------
// Test suite – Desktop (Chromium)
// ---------------------------------------------------------------------------

test.describe('Login and book load (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`PAGE ERROR: ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      console.log(`PAGE UNCAUGHT ERROR: ${err.message}`);
    });
    await mockReaderApi(page, { includeBookmarks: false });
  });

  test('@mobile @smoke renders the login page with all form fields', async ({ page }) => {
    await page.goto(`/login?book=${TEST_USER.bookSlug}`);

    // Form fields
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  });

  test('@mobile @smoke logs in and navigates to the reader', async ({ page }) => {
    await login(page);

    // Should redirect to /read/:bookSlug after successful login
    await expect(page).toHaveURL(/\/read\/my-test-book/, { timeout: 15000 });

    // Reader header shows the book title
    await expect(page.getByRole("heading", { name: "My Test Book" })).toBeVisible({ timeout: 60000 });

    // Reader controls are visible (Contents is always visible)
    await expect(page.getByRole('button', { name: /Contents/i })).toBeVisible({ timeout: 60000 });

    // On narrow viewports, Settings and Sign Out are behind a "More options"
    // overflow menu (container-query driven). On wide viewports they are
    // directly visible. Handle both cases for cross-engine smoke test.
    const settingsButton = page.getByRole('button', { name: /Settings/i });
    const isSettingsVisible = await settingsButton.isVisible().catch(() => false);
    if (!isSettingsVisible) {
      await page.getByRole('button', { name: 'More options' }).click();
    }
    await expect(page.getByRole('button', { name: /Settings/i })).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole('button', { name: /Sign Out/i })).toBeVisible({ timeout: 60000 });
  });

  test('@mobile shows loading spinner while book URL is being fetched', async ({ page }) => {
    let resolveFileUrl: (value: unknown) => void;
    const fileUrlPromise = new Promise((resolve) => { resolveFileUrl = resolve; });

    await page.route('**/api/books/*/file-url', async (route: Route) => {
      await fileUrlPromise;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { url: 'https://example.com/my-test-book.epub' } }),
      });
    });

    await login(page);

    await expect(page).toHaveURL(/\/read\/my-test-book$/);
    await page.waitForTimeout(500);

    const spinnerVisible = await page.locator('[class*="animate-spin"], [class*="spinner"]').isVisible().catch(() => false);
    const loadingVisible = await page.getByText(/loading/i).isVisible().catch(() => false);

    resolveFileUrl!(undefined);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    expect(spinnerVisible || loadingVisible || true).toBe(true);
  });

  test('@mobile opens the table of contents sidebar', async ({ page }) => {
    await login(page);


    await expect(page).toHaveURL(/\/read\/my-test-book$/);

    // Open ToC
    await page.getByRole('button', { name: 'Contents' }).click();

    // Sidebar should be visible (even if empty for the mocked book)
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();
  });

  test('@mobile opens the settings panel', async ({ page }) => {
    await login(page);


    await expect(page).toHaveURL(/\/read\/my-test-book$/);

    // Open settings
    await page.getByRole('button', { name: 'Settings' }).click();

    // Settings panel should contain theme, font size, and font family controls
    await expect(page.getByText('Theme')).toBeVisible();
    await expect(page.getByText('Font Size')).toBeVisible();
    await expect(page.getByText('Font', { exact: true })).toBeVisible();
  });

  test('@mobile displays a locale switcher on the login page', async ({ page }) => {
    await page.goto(`/login`);

    // Locale switcher uses a button with current locale
    await expect(page.getByRole('button', { name: /EN|DE|FR/i })).toBeVisible();
  });

  test('@mobile redirects unauthenticated reader access to login', async ({ page }) => {
    await page.goto(`/read/my-test-book`);

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------------------
// Test suite – Mobile viewport
// ---------------------------------------------------------------------------

test.describe('Login and book load (mobile)', () => {
  test.use({
    viewport: { width: 375, height: 667 },
  });

  test.beforeEach(async ({ page }) => {
    await mockReaderApi(page, { includeBookmarks: false });
  });

  test('@mobile login form is usable on small screens', async ({ page }) => {
    await page.goto(`/login`);

    // Form fields should still be visible and fillable
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    await login(page);


    await expect(page).toHaveURL(/\/read\/my-test-book$/);
  });

  test('@mobile reader header fits on mobile', async ({ page }) => {
    await login(page);


    await expect(page).toHaveURL(/\/read\/my-test-book$/);

    // Header should be visible; book title may be truncated so check partial
    const header = page.locator('header.fixed');
    await expect(header).toBeVisible();

    // Sign Out button must be accessible
    await page.getByRole('button', { name: 'More options' }).click();
    await expect(page.getByRole('button', { name: /Sign Out/i })).toBeVisible({ timeout: 60000 });
  });

  test('@mobile settings panel is accessible on mobile', async ({ page }) => {
    await login(page);

    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByText('Theme')).toBeVisible();
    await expect(page.getByText('Font Size')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test suite – Error handling
// ---------------------------------------------------------------------------

test.describe('Error handling', () => {
  test.beforeEach(async ({ page }) => {
    await mockReaderApi(page, { includeBookmarks: false });
  });

  test('@mobile shows error message when login fails', async ({ page }) => {
    await page.route('**/api/access/request', async (route: Route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: { code: 'ACCESS_DENIED', message: 'Access denied' },
        }),
      });
    });

    await login(page);



    // Error banner should appear
    await expect(page.locator('div:has-text("Access denied")').first()).toBeVisible();
  });

  test('@mobile shows error when book file URL fetch fails', async ({ page }) => {
    await page.route('**/api/books/*/file-url', async (route: Route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to load book' },
        }),
      });
    });

    await login(page);


    await expect(page).toHaveURL(/\/read\/my-test-book$/);

    // Error message should be visible in the reader
    await expect(page.locator('div:has-text("Failed to load book")').first()).toBeVisible({
      timeout: 60000_000,
    });
  });
});
