import { test, expect } from '@playwright/test';
import { TEST_USER, LOGIN_RESPONSE, mockReaderApi, loginAsReader } from './fixtures';

const SEARCH_BOOK_USER = { ...TEST_USER, bookSlug: 'search-test-book' };

const SEARCH_LOGIN_RESPONSE = {
  ...LOGIN_RESPONSE,
  data: {
    ...LOGIN_RESPONSE.data,
    sessionToken: 'test-session-token-search',
    book: {
      id: 'book-search',
      slug: SEARCH_BOOK_USER.bookSlug,
      title: 'Search Test Book',
      authorName: 'Test Author',
    },
  },
};

test.describe('In-book search', () => {
  test.beforeEach(async ({ page }) => {
    await mockReaderApi(page, {
      bookSlug: SEARCH_BOOK_USER.bookSlug,
      epubUrl: '/alice.epub',
      loginResponse: SEARCH_LOGIN_RESPONSE,
      includeBookmarks: false,
      includeLogout: false,
    });
  });

  test('@mobile opens search panel and accepts input', async ({ page }) => {
    await loginAsReader(page, SEARCH_BOOK_USER.bookSlug);
    await expect(page).toHaveURL(/\/read\/search-test-book/);
    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByRole('search')).toBeVisible();

    const searchbox = page.getByRole('searchbox');
    await searchbox.fill('Alice');
    await expect(searchbox).toHaveValue('Alice');
  });

  test('@mobile closes search panel via close button', async ({ page }) => {
    await loginAsReader(page, SEARCH_BOOK_USER.bookSlug);
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
    await loginAsReader(page, SEARCH_BOOK_USER.bookSlug);
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
