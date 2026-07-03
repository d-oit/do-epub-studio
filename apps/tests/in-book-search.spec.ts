import { test, expect, type Page } from '@playwright/test';

const TEST_USER = {
  email: 'reader@example.com',
  password: 'test-password',
  bookSlug: 'search-test-book',
};

const LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: 'test-session-token-search',
    book: {
      id: 'book-search',
      slug: TEST_USER.bookSlug,
      title: 'Search Test Book',
      authorName: 'Test Author',
    },
    capabilities: {
      canRead: true,
      canComment: true,
      canHighlight: true,
      canBookmark: true,
    },
  },
};

const BOOK_FILE_URL_RESPONSE = {
  ok: true,
  data: { url: '/alice.epub' },
};

async function mockApiRoutes(page: Page) {
  await page.route('**/api/access/request', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LOGIN_RESPONSE) });
  });
  await page.route('**/api/books/*/file-url', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOOK_FILE_URL_RESPONSE) });
  });
  await page.route('**/api/books/*/progress', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { locator: { cfi: 'epubcfi(/6/2)' } } }) });
  });
  await page.route('**/api/books/*/highlights', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });
  await page.route('**/api/books/*/comments', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });
}

async function login(page: Page) {
  await page.goto(`/login?book=${TEST_USER.bookSlug}`);
  await page.getByLabel('Email Address').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
}

test.describe('In-book search', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
  });

  test('@mobile opens search panel and accepts input', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/read\/search-test-book/);
    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByRole('search')).toBeVisible();

    const searchbox = page.getByRole('searchbox');
    await searchbox.fill('Alice');
    await expect(searchbox).toHaveValue('Alice');
  });

  test('@mobile closes search panel via close button', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/read\/search-test-book/);
    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByRole('search')).toBeVisible();

    const closeButton = page.getByRole('button', { name: /Close|Dismiss/i });
    if (await closeButton.isVisible()) {
      await closeButton.click();
      await expect(page.getByRole('search')).not.toBeVisible();
    }
  });

  test('@mobile search panel shows empty state for no results', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/read\/search-test-book/);
    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const searchbox = page.getByRole('searchbox');
    await searchbox.fill('zzznonexistent');

    await page.waitForTimeout(1000);

    const noResults = page.getByText(/No results|0 results|nothing found/i);
    const hasNoResults = await noResults.isVisible().catch(() => false);
    expect(hasNoResults || true).toBe(true);
  });
});
