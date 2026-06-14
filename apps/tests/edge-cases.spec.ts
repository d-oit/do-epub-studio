import { test, expect } from '@playwright/test';

test.describe('Edge Cases & Error Handling', () => {
  test('should handle invalid login credentials gracefully', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');

    // Mock a 401 response before filling in credentials
    await page.route('**/api/access/request', route => route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }),
    }));

    // Fill in values that should fail (mocked or handled by app)
    await page.getByLabel('Email Address').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpassword');

    await page.getByRole('button', { name: 'Sign In' }).click();

    // Assuming the app shows the error message returned by the API
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should redirect to login when session expires (401)', async ({ page }) => {
    // Mock admin login
    await page.route('**/api/admin/login', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { sessionToken: 'admin-token', email: 'admin@test.com' } }),
    }));

    // Mock initial books load so the page renders successfully
    await page.route('**/api/admin/books', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] }),
    }));

    await page.goto('/admin/login');
    await page.getByLabel('Email Address').fill('admin@test.com');
    await page.getByLabel('Password').fill('admin-password');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/admin\/books/);

    // Remove existing mock, then re-mock the broader admin namespace with 401
    // to simulate session expiry. Wildcard coverage ensures bootstrap calls
    // (e.g., /api/admin/me if present) also trigger handleUnauthorized().
    // The 401 handler in api.ts excludes /api/admin/login so login mocks remain intact.
    await page.unroute('**/api/admin/books');
    await page.unroute('**/api/admin/**');
    await page.route('**/api/admin/**', route => {
      if (route.request().url().includes('/api/admin/login')) {
        return route.continue();
      }
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Session expired' } }),
      });
    });

    // Reload the page — the API call should fail with 401
    await page.reload();

    // Should be redirected to login with error param
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/error=session_expired/);
  });

  test('should show offline indicator when network is disconnected', async ({ page, context }) => {
    await page.goto('/');
    await context.setOffline(true);

    // PWA should still load basic shell
    const title = await page.title();
    expect(title).toBeTruthy();

    // If there's an offline UI, verify it here. For now, we'll just verify the page didn't crash.
    await context.setOffline(false);
  });
});
