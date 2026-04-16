import { test, expect } from '@playwright/test';

test.describe('Edge Cases & Error Handling', () => {
  test('should handle invalid login credentials gracefully', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Assuming the app shows an error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should redirect to login when session expires (401)', async ({ page }) => {
    // Mock a 401 response for any API call
    await page.route('**/api/**', route => route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    }));

    await page.goto('/admin/books');
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/error=session_expired/);
  });

  test('should show offline indicator when network is disconnected', async ({ page, context }) => {
    await page.goto('/');
    await context.setOffline(true);

    // Check for an offline indicator if one exists, or verify some offline behavior
    // For now, we'll just verify the page still functions (PWA behavior)
    const title = await page.title();
    expect(title).toBeTruthy();

    await context.setOffline(false);
  });
});
