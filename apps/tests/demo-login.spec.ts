import { test, expect } from '@playwright/test';
import { mockReaderApi, mockAdminApi, suppressWorkboxErrors, DEMO_READER, DEMO_ADMIN, DEMO_READER_RESPONSE, DEMO_ADMIN_RESPONSE } from './fixtures';

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

    const demoButton = page.getByRole('button', { name: 'Try the demo' });
    await expect(demoButton).toBeVisible();

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

    await page.getByRole('button', { name: 'Try the demo' }).click();

    // The demo button must surface the fail-closed error instead of navigating.
    await expect(page.getByText('Demo login is not available.')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('@mobile @smoke signs in as the demo reader with email + password', async ({ page }) => {
    // The demo reader account has a documented password; the normal
    // /api/access/request flow authenticates it against the seeded hash.
    await mockReaderApi(page, { bookSlug: DEMO_READER.bookSlug, loginResponse: DEMO_READER_RESPONSE });
    await page.goto(`/login?book=${DEMO_READER.bookSlug}`);

    // "Fill demo credentials" autofills the documented demo account into the
    // form (ADR-245 replaces the plaintext info line with this action).
    await page.getByRole('button', { name: 'Fill demo credentials' }).click();
    await expect(page.getByLabel('Email Address')).toHaveValue(DEMO_READER.email);
    await expect(page.getByRole('textbox', { name: 'Password' })).toHaveValue(DEMO_READER.password);

    // Sign in through the normal credential form with the demo credentials.
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(page).toHaveURL(/\/read\/demo$/, { timeout: 15000 });
    await expect(page.locator('[data-container-name="reader-toolbar"]')).toBeVisible({ timeout: 20000 });
  });

  // ---------------------------------------------------------------------
  // Help link (reader + admin)
  // ---------------------------------------------------------------------

  test('@mobile renders a help link on the reader login screen', async ({ page }) => {
    await page.goto('/login');

    const helpLink = page.getByRole('link', { name: 'Help / How to use' });
    await expect(helpLink).toBeVisible();
    // Amendment B: VITE_HELP_URL=/help is a same-origin in-app route.
    await expect(helpLink).toHaveAttribute('href', '/help');
  });

  test('@mobile renders a help link on the admin login screen', async ({ page }) => {
    await page.goto('/admin/login');

    const helpLink = page.getByRole('link', { name: 'Help / How to use' });
    await expect(helpLink).toBeVisible();
    await expect(helpLink).toHaveAttribute('href', '/help');
  });

  test('@mobile @smoke signs in as the demo admin with email + password', async ({ page }) => {
    // The demo admin account has a documented password; /api/admin/login
    // authenticates it against the seeded hash.
    await mockAdminApi(page, { adminLoginResponse: DEMO_ADMIN_RESPONSE });
    await page.goto('/admin/login');

    // "Fill admin credentials" autofills the documented demo admin account.
    await page.getByRole('button', { name: 'Fill admin credentials' }).click();
    await expect(page.getByLabel('Email Address')).toHaveValue(DEMO_ADMIN.email);
    await expect(page.getByRole('textbox', { name: 'Password' })).toHaveValue(DEMO_ADMIN.password);

    // Sign in through the normal credential form with the demo credentials.
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(page).toHaveURL(/\/admin\/books$/, { timeout: 15000 });
    await expect(page.locator('main#main-content')).toBeVisible({ timeout: 20000 });
  });

  // ---------------------------------------------------------------------
  // Admin demo
  // ---------------------------------------------------------------------

  test('@mobile shows admin demo button and signs in via demo endpoint', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/login');

    const demoButton = page.getByRole('button', { name: 'Try admin demo' });
    await expect(demoButton).toBeVisible();

    await demoButton.click();

    await expect(page).toHaveURL(/\/admin\/books$/, { timeout: 15000 });
    await expect(page.locator('main#main-content')).toBeVisible({ timeout: 20000 });
  });
});
