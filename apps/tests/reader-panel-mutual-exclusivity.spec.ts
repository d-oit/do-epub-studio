import { test, expect, type Page, type Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants & fixtures
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: 'reader@example.com',
  password: process.env.TEST_PASSWORD || 'test-password',
  bookSlug: 'my-test-book',
};

const LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: 'test-session-token',
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
      canDownloadOffline: true,
      canExportNotes: true,
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

const HIGHLIGHTS_RESPONSE = { ok: true, data: [] };
const COMMENTS_RESPONSE = { ok: true, data: [] };
const BOOKMARKS_RESPONSE = { ok: true, data: [] };

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
      body: JSON.stringify(HIGHLIGHTS_RESPONSE),
    });
  });

  await page.route('**/api/books/*/comments', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(COMMENTS_RESPONSE),
    });
  });

  await page.route('**/api/books/*/bookmarks', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(BOOKMARKS_RESPONSE),
    });
  });
}

async function loginAndNavigateToReader(page: Page) {
  await page.goto(`/login?book=${TEST_USER.bookSlug}`);
  await page.getByLabel('Email Address').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/read/${TEST_USER.bookSlug}`));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Reader side-panel mutual exclusivity', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await loginAndNavigateToReader(page);
  });

  test('opening search panel closes table of contents', async ({ page }) => {
    // Open ToC
    // ReaderToolbar uses aria-label={t('reader.tableOfContents')} which is "Contents"
    await page.getByRole('button', { name: 'Contents', exact: true }).click();
    // TableOfContents heading is {t('reader.tableOfContents')} which is "Contents"
    await expect(page.getByRole('heading', { name: 'Contents', exact: true })).toBeVisible();

    // Open Search
    // ReaderToolbar uses aria-label={t('reader.search')} which is "Search"
    await page.getByRole('button', { name: 'Search', exact: true }).click();

    // Search should be visible
    // SearchPanel heading is {t('reader.search')} which is "Search"
    await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();

    // ToC should be hidden
    await expect(page.getByRole('heading', { name: 'Contents', exact: true })).not.toBeVisible();
  });

  test('opening settings panel closes bookmarks panel', async ({ page }) => {
    // Open Bookmarks
    // ReaderToolbar uses aria-label={t('reader.bookmarks')} which is "Bookmarks"
    await page.getByRole('button', { name: 'Bookmarks', exact: true }).click();
    // BookmarksPanel heading is hardcoded "Bookmarks"
    await expect(page.getByRole('heading', { name: 'Bookmarks', exact: true })).toBeVisible();

    // Open Settings
    // ReaderToolbar uses aria-label={t('reader.settings')} which is "Settings"
    await page.getByRole('button', { name: 'Settings', exact: true }).click();

    // Settings should be visible
    // ReaderSettingsPanel has a heading {t('reader.settings')} which is "Settings"
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

    // Bookmarks should be hidden
    await expect(page.getByRole('heading', { name: 'Bookmarks', exact: true })).not.toBeVisible();
  });

  test('opening info panel closes comments panel', async ({ page }) => {
    // Open Comments
    // The button title is from translation 'annotation.comment' which is "Comment"
    // ReaderToolbar uses IconButton with aria-label={t('annotation.comment')}
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    // CommentsPanel heading is {t('annotation.comment')}s which is "Comments"
    await expect(page.getByRole('heading', { name: 'Comments', exact: true })).toBeVisible();

    // Open Info
    // The button title is from translation 'reader.aboutBook' which is "About This Book"
    await page.getByRole('button', { name: 'About This Book', exact: true }).click();

    // Info should be visible
    // InfoPanel heading is {t('reader.aboutBook')} which is "About This Book"
    await expect(page.getByRole('heading', { name: 'About This Book', exact: true })).toBeVisible();

    // Comments should be hidden
    await expect(page.getByRole('heading', { name: 'Comments', exact: true })).not.toBeVisible();
  });

  test('clicking the active panel button closes it', async ({ page }) => {
    // Open ToC
    await page.getByRole('button', { name: 'Contents', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Contents', exact: true })).toBeVisible();

    // Click ToC again to close
    await page.getByRole('button', { name: 'Contents', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Contents', exact: true })).not.toBeVisible();
  });
});
