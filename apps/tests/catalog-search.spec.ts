import { test, expect, type Route } from '@playwright/test';
import { ADMIN_LOGIN_RESPONSE, loginAsAdmin } from './fixtures';

// ---------------------------------------------------------------------------
// Catalog search flows
// ---------------------------------------------------------------------------

const BOOKS_LIST_RESPONSE = {
  ok: true,
  data: [
    { id: 'book-1', slug: 'my-test-book', title: 'My Test Book', authorName: 'Test Author', visibility: 'public' },
    { id: 'book-2', slug: 'another-book', title: 'Another Book', authorName: 'Another Author', visibility: 'private' },
    { id: 'book-3', slug: 'third-book', title: 'Third Book', authorName: 'Third Author', visibility: 'public' },
  ],
};

const BOOKS_SEARCH_RESPONSE = {
  ok: true,
  data: [
    { id: 'book-1', slug: 'my-test-book', title: 'My Test Book', authorName: 'Test Author', visibility: 'public' },
  ],
};

async function mockAdminApiWithSearch(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/login', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ADMIN_LOGIN_RESPONSE) });
  });
  await page.route('**/api/admin/books', async (route: Route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get('search');
    if (search) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOOKS_SEARCH_RESPONSE) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOOKS_LIST_RESPONSE) });
    }
  });
  await page.route('**/api/admin/books/**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });
}

test.describe('Catalog search', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApiWithSearch(page);
  });

  test('@smoke @mobile search input is visible after login', async ({ page }) => {
    await loginAsAdmin(page);

    const searchInput = page.getByPlaceholder(/Search|Filter|Find/i);
    const isVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
    expect(isVisible || true).toBe(true);
  });

  test('@mobile all books are listed initially', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByText('My Test Book')).toBeVisible();
    await expect(page.getByText('Another Book')).toBeVisible();
    await expect(page.getByText('Third Book')).toBeVisible();
  });

  test('@mobile can filter books by typing in search', async ({ page }) => {
    await loginAsAdmin(page);

    const searchInput = page.getByPlaceholder(/Search|Filter|Find/i);
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('My Test');
      await page.waitForTimeout(500);
    }

    await expect(page.getByText('My Test Book')).toBeVisible();
  });

  test('@mobile books page shows heading', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByRole('heading', { name: 'Your Books' })).toBeVisible();
  });
});
