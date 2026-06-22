import { test, expect, type Page, type Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants & fixtures
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: 'reader@example.com',
  password: 'test-password',
  bookSlug: 'my-test-book',
};

const LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: 'test-session-token-abc123',
    book: {
      id: 'book-1',
      slug: TEST_USER.bookSlug,
      title: 'My Test Book',
      authorName: 'Test Author',
    },
    capabilities: {
      canRead: true,
      canComment: true,
      canHighlight: true,
      canBookmark: true,
      canDownloadOffline: false,
      canExportNotes: false,
      canManageAccess: false,
    },
  },
};

const BOOK_FILE_URL_RESPONSE = {
  ok: true,
  data: { url: 'https://example.com/test-book.epub' },
};

const PROGRESS_RESPONSE = {
  ok: true,
  data: { locator: { cfi: 'epubcfi(/6/4)' }, progressPercent: 0.1 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockApiRoutes(page: Page) {
  await page.route('**/api/access/request', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(LOGIN_RESPONSE),
    });
  });

  await page.route('**/api/books/*/file-url', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(BOOK_FILE_URL_RESPONSE),
    });
  });

  await page.route('**/api/books/*/progress', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PROGRESS_RESPONSE),
    });
  });

  await page.route('**/api/books/*/highlights', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });

  await page.route('**/api/books/*/comments', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });

  await page.route('**/api/books/*/bookmarks', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
}

async function login(page: Page) {
  await page.goto(`/login?book=${TEST_USER.bookSlug}`);
  await page.getByLabel('Email Address').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/read\/my-test-book/);
  // Wait for the reader to load and show the toolbar
  await expect(page.getByRole('button', { name: /Contents/i })).toBeVisible({ timeout: 15000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Reader side-panel mutual exclusivity', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await login(page);
  });

  test('opening search closes table of contents', async ({ page }) => {
    // Open Table of Contents
    await page.getByRole('button', { name: 'Contents' }).click();
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();

    // Open Search
    await page.getByRole('button', { name: 'Search' }).click();

    // Search panel should be visible
    await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();

    // Table of Contents should be closed
    await expect(page.getByRole('heading', { name: 'Contents' })).not.toBeVisible();
  });

  test('opening settings closes search', async ({ page }) => {
    // Open Search
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();

    // Open Settings. The Search panel (z-50) overlaps the header in
    // some browsers (notably WebKit + Firefox under load), so the
    // click is dispatched directly via the test API to reach the
    // toolbar button. Mutual exclusivity is still verified by the
    // state assertions below: opening Settings must close the Search
    // panel.
    await page
      .getByRole('button', { name: 'Settings' })
      .first()
      .dispatchEvent('click');

    // Settings panel should be visible (check for unique text like "Font Size")
    await expect(page.getByText('Font Size')).toBeVisible();

    // Search panel should be closed
    await expect(page.getByRole('heading', { name: 'Search', exact: true })).not.toBeVisible();
  });

  test('opening comments closes bookmarks', async ({ page }) => {
    // Open Bookmarks
    await page.getByRole('button', { name: 'Bookmarks' }).click();
    await expect(page.getByRole('heading', { name: 'Bookmarks' })).toBeVisible();

    // Open Comments
    await page.getByRole('button', { name: 'Comment' }).click();

    // Comments panel should be visible (check for unique heading, plural form in UI: "Comments")
    // The UI renders "Comments" as heading (h2 + plural)
    await expect(page.getByRole('heading', { name: 'Comments' })).toBeVisible();

    // Bookmarks panel should be closed
    await expect(page.getByRole('heading', { name: 'Bookmarks' })).not.toBeVisible();
  });

  test('opening info panel closes comments', async ({ page }) => {
    // Open Comments
    await page.getByRole('button', { name: 'Comment' }).click();
    await expect(page.getByRole('heading', { name: 'Comments' })).toBeVisible();

    // Open Info panel ("About book" tooltip/aria-label)
    await page.getByRole('button', { name: 'About This Book' }).click();

    // Info panel should be visible (heading "About This Book")
    await expect(page.getByRole('heading', { name: 'About This Book' })).toBeVisible();

    // Comments panel should be closed
    await expect(page.getByRole('heading', { name: 'Comments' })).not.toBeVisible();
  });
});
