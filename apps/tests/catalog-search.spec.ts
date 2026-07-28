import { test, expect } from '@playwright/test';
import { mockAdminApi, loginAsAdmin } from './fixtures';

test.describe('Catalog search and filtering', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApi(page);
  });

  test('@smoke @mobile displays books list after admin login', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Your Books' })).toBeVisible();
    await expect(page.getByText('My Test Book')).toBeVisible();
  });

  test('@mobile books page heading is visible', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Your Books' })).toBeVisible();
  });

  test('@mobile can view book details', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByText('My Test Book')).toBeVisible();
    // Admin BooksPage renders title and visibility, not authorName
    await expect(page.getByText('private')).toBeVisible();
  });

  test('@mobile can navigate to grants from book list', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /Manage Access/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/books\/book-1\/grants/);
  });
});
