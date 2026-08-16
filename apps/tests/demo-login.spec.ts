import { test, expect } from '@playwright/test';
import { mockReaderApi, mockAdminApi, suppressWorkboxErrors, DEMO_READER_RESPONSE } from './fixtures';

// ---------------------------------------------------------------------------
// ADR-244 / GOAP-244: demo login entry points + help links.
//
// The demo buttons and help link only render when the frontend build baked in
// VITE_DEMO_LOGIN_ENABLED=1 / VITE_HELP_URL. The scheduled CI e2e build does
// NOT set these (fail-closed defaults), so these tests are gated on the
// E2E_DEMO_LOGIN=1 env var — set it when running against a demo-enabled build.
// ---------------------------------------------------------------------------

const DEMO_E2E_ENABLED = process.env.E2E_DEMO_LOGIN === '1';

test.describe('Demo login entry points (ADR-244)', () => {
  test.skip(!DEMO_E2E_ENABLED, 'demo login not built into this preview (E2E_DEMO_LOGIN != 1)');

  test.beforeEach(async ({ page }) => {
    suppressWorkboxErrors(page);
  });

  // ---------------------------------------------------------------------
  // Reader demo
  // ---------------------------------------------------------------------

  test('@mobile @smoke shows the reader demo button and logs in via demo endpoint', async ({ page }) => {
    await mockReaderApi(page, { demoLoginResponse: DEMO_READER_RESPONSE });
    await page.goto('/login?book=demo');

    const demoButton = page.getByRole('button', { name: 'Use reader demo' });
    await expect(demoButton).toBeVisible();

    // Demo info panel shows the reserved email and book slug (Amendment A).
    await expect(page.getByText(/Demo account: demo\.reader@example\.local/)).toBeVisible();

    await demoButton.click();


    // Reader demo mints a session for the configured demo book and navigates into it.
    await expect(page).toHaveURL(/\/read\/demo$/, { timeout: 15000 });
    await expect(page.locator('[data-container-name="reader-toolbar"]')).toBeVisible({ timeout: 20000 });
  });

  test('@mobile shows a reader demo error when the demo endpoint is disabled', async ({ page }) => {
    await page.route('**/api/demo/reader-login', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'DEMO_DISABLED', message: 'Demo login is not available.' } }),
      });
    });
    await page.goto('/login?book=demo');

    await page.getByRole('button', { name: 'Use reader demo' }).click();

    // The demo button must surface the fail-closed error instead of navigating.
    await expect(page.getByText('Demo login is not available.')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  // ---------------------------------------------------------------------
  // Help link (reader + admin)
  // ---------------------------------------------------------------------

  test('@mobile renders a help link on the reader login screen', async ({ page }) => {
    await page.goto('/login');

    const helpLink = page.getByRole('link', { name: 'Help / How to use' });
    await expect(helpLink).toBeVisible();
    await expect(helpLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('@mobile renders a help link on the admin login screen', async ({ page }) => {
    await page.goto('/admin/login');

    const helpLink = page.getByRole('link', { name: 'Help / How to use' });
    await expect(helpLink).toBeVisible();
    await expect(helpLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // ---------------------------------------------------------------------
  // Admin demo
  // ---------------------------------------------------------------------

  test('@mobile shows admin demo button and signs in via demo endpoint', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/login');

    const demoButton = page.getByRole('button', { name: 'Use admin demo' });
    await expect(demoButton).toBeVisible();

    // Demo info panel shows the reserved admin email (Amendment A).
    await expect(page.getByText(/demo\.admin@example\.local/)).toBeVisible();

    await demoButton.click();

    await expect(page).toHaveURL(/\/admin\/books$/, { timeout: 15000 });
    await expect(page.locator('main#main-content')).toBeVisible({ timeout: 20000 });
  });
});
