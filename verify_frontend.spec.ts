import { test, expect } from '@playwright/test';

test('login page screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await expect(page).toHaveTitle('do EPUB Studio');
  await page.screenshot({ path: 'login-page.png' });
});
