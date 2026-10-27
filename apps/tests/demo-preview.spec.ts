import { test, expect, type Page } from '@playwright/test';

async function openStartChapter(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Contents', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Contents', exact: true })
    .getByRole('button', { name: 'Start', exact: true })
    .click();
}

// Runs only in the dedicated opt-in project. No API/content interception:
// exercise the Pages bundle, preview bindings and generated sample EPUB.
test.describe('Provisioned demo preview', () => {
  test.describe.configure({ mode: 'serial' });

  test('reader demo opens a real EPUB on the preview origin', async ({ page }) => {
    await page.goto('/login');
    const fileResponse = page.waitForResponse((response) => {
      return response.url().includes('/api/files/') && response.status() === 200;
    });
    await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
    await expect(page).toHaveURL(/\/read\/demo$/);
    const file = await fileResponse;
    expect(new URL(file.url()).origin).toBe(new URL(page.url()).origin);
    await openStartChapter(page);
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('iframe')?.contentDocument?.body.textContent),
      )
      .toContain('Welcome to the demo');
    const savedSecondChapter = page.waitForResponse((response) => {
      if (!response.url().endsWith('/progress') || response.request().method() !== 'PUT') {
        return false;
      }
      const body = response.request().postDataJSON() as { locator?: { cfi?: string } };
      return response.ok() && Boolean(body.locator?.cfi?.includes('/6/4'));
    });
    await page.getByRole('button', { name: 'Contents', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Contents', exact: true })
      .getByRole('button', { name: 'Try annotations', exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('iframe')?.contentDocument?.body.textContent),
      )
      .toContain('Select this sentence to add a highlight or comment.');
    await savedSecondChapter;
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('iframe')?.contentDocument?.body.textContent),
      )
      .toContain('Select this sentence to add a highlight or comment.');
  });

  test('autofill selects the demo book before normal credential sign-in', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Fill demo credentials', exact: true }).click();
    await expect(page).toHaveURL(/\/login\?book=demo$/);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/\/read\/demo$/);
    await openStartChapter(page);
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('iframe')?.contentDocument?.body.textContent),
      )
      .toContain('Welcome to the demo');
  });

  test('explicitly enabled preview administrator can enter the demo', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByRole('button', { name: 'Try admin demo', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/books/);
    await expect(page.getByRole('heading', { name: 'Your Books', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Demo Book', exact: true })).toBeVisible();
  });
});
