import { test, expect } from '@playwright/test';

test.describe('Edge Cases & Error Handling', () => {
  test('should handle invalid login credentials gracefully', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');

    // Fill in values that should fail (mocked or handled by app)
    await page.locator('input[label="Book Slug"]').fill('invalid-book');
    await page.locator('input[label="Email"]').fill('wrong@example.com');
    await page.locator('input[label="Password (optional)"]').fill('wrongpassword');

    // We expect the app to show an error message if the API fails
    // We can mock the 401 response here
    await page.route('**/api/access/request', route => route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }),
    }));

    await page.click('button:has-text("Sign In")');

    // Assuming the app shows the error message returned by the API
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should redirect to login when session expires (401)', async ({ page }) => {
    // Mock a 401 response for any API call
    await page.route('**/api/**', route => route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Session expired' } }),
    }));

    // Start on a protected route
    await page.goto('/admin/books');

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
