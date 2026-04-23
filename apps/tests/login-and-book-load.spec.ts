import { test, expect, Page, Route } from '@playwright/test';

const APP_URL = 'http://localhost:5173';

const TEST_USER = {
  bookSlug: 'my-test-book',
  email: 'test@example.com',
  password: 'password123',
};

const LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: 'fake-jwt-token',
    user: {
      email: TEST_USER.email,
      role: 'reader',
    },
    book: {
      id: 'book-123',
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

const HIGHLIGHTS_RESPONSE = { ok: true, data: [] };
const COMMENTS_RESPONSE = { ok: true, data: [] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mock every API endpoint the login -> reader flow touches so the test runs
 * fully offline with deterministic responses.
 */
async function mockApiRoutes(page: Page) {
  // Login endpoint
  await page.route('**/api/access/request', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(LOGIN_RESPONSE),
    });
  });

  // Book file URL fetch (ReaderPage fetches this after login)
  await page.route('**/api/books/*/file-url', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(BOOK_FILE_URL_RESPONSE),
    });
  });

  // Reading progress (GET on load + PUT on relocate)
  await page.route('**/api/books/*/progress', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PROGRESS_RESPONSE),
    });
  });

  // Annotations
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

  // Logout (best-effort, may not be called in test)
  await page.route('**/api/access/logout', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: {} }),
    });
  });
}

/**
 * Fill out the login form and submit it.
 */
async function login(page: Page) {
  await page.getByLabel('Book URL Slug').fill(TEST_USER.bookSlug);
  await page.getByLabel('Email Address').fill(TEST_USER.email);
  await page.getByLabel('Password (if required)').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

// ---------------------------------------------------------------------------
// Test suite – Desktop (Chromium)
// ---------------------------------------------------------------------------

test.describe('Login and book load (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
  });

  test('@smoke renders the login page with all form fields', async ({ page }) => {
    await page.goto(APP_URL);

    // Root redirects to /login
    await expect(page).toHaveURL(/\/login$/);

    // Page heading
    await expect(page.getByRole('heading', { name: 'do EPUB Studio' })).toBeVisible();
    await expect(page.getByText('Sign in to access your books')).toBeVisible();

    // Form fields
    await expect(page.getByLabel('Book URL Slug')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password (if required)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('@smoke logs in and navigates to the reader', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await login(page);

    // Should redirect to /read/:bookSlug after successful login
    await expect(page).toHaveURL(/\/read\/my-test-book$/);

    // Reader header shows the book title
    await expect(page.getByRole('heading', { name: 'My Test Book' })).toBeVisible();

    // Reader controls are visible
    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
  });

  test('shows loading spinner while book URL is being fetched', async ({ page }) => {
    // Slow down the file-url response to make loading state visible
    await page.route('**/api/books/*/file-url', async (route: Route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BOOK_FILE_URL_RESPONSE),
      });
    });

    await page.goto(`${APP_URL}/login`);
    await login(page);

    // After navigation, the loading spinner should appear briefly
    const spinner = page.locator('div.animate-spin');
    await expect(spinner).toBeVisible({ timeout: 3_000 });
  });

  test('opens the table of contents sidebar', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await login(page);
    await expect(page).toHaveURL(/\/read\/my-test-book$/);

    // Webkit/Safari may need a moment for layout/animations to settle
    await page.waitForLoadState('networkidle');

    // Open ToC
    await page.getByRole('button', { name: 'Contents' }).click();

    // Sidebar should be visible (even if empty for the mocked book)
    // Using a longer timeout to account for animations
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible({ timeout: 10_000 });
  });

  test('opens the settings panel', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await login(page);
    await expect(page).toHaveURL(/\/read\/my-test-book$/);

    await page.waitForLoadState('networkidle');

    // Open settings
    await page.getByRole('button', { name: 'Settings' }).click();

    // Settings panel should contain theme, font size, and font family controls
    await expect(page.getByText('Theme')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Font Size')).toBeVisible();
    await expect(page.getByText('Font')).toBeVisible();
  });

  test('displays a locale switcher on the login page', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);

    // Locale switcher uses a button with current locale
    await expect(page.getByRole('button', { name: /EN|DE|FR/i })).toBeVisible();
  });

  test('redirects unauthenticated reader access to login', async ({ page }) => {
    // Clear persisted auth state by using a fresh context
    await page.goto(`${APP_URL}/read/my-test-book`);

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login$/);
  });
});

// ---------------------------------------------------------------------------
// Test suite – Mobile viewport
// ---------------------------------------------------------------------------

test.describe('Login and book load (mobile)', () => {
  test.use({
    viewport: { width: 375, height: 667 },
  });

  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
  });

  test('login form is usable on small screens', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);

    // Form fields should still be visible and fillable
    await expect(page.getByLabel('Book URL Slug')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password (if required)')).toBeVisible();

    await login(page);
    await expect(page).toHaveURL(/\/read\/my-test-book$/);
  });

  test('reader header fits on mobile', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await login(page);
    await expect(page).toHaveURL(/\/read\/my-test-book$/);

    // Header should be visible; book title may be truncated so check partial
    const header = page.locator('header.fixed');
    await expect(header).toBeVisible();

    // Sign Out button must be accessible
    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
  });

  test('settings panel is accessible on mobile', async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await login(page);

    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByText('Theme')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Font Size')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test suite – Error handling
// ---------------------------------------------------------------------------

test.describe('Error handling', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
  });

  test('shows error message when login fails', async ({ page }) => {
    await page.route('**/api/access/request', async (route: Route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: { code: 'ACCESS_DENIED', message: 'Access denied' },
        }),
      });
    });

    await page.goto(`${APP_URL}/login`);
    await login(page);

    // Error banner should appear
    await expect(page.locator('div:has-text("Access denied")').first()).toBeVisible();
  });

  test('shows error when book file URL fetch fails', async ({ page }) => {
    await page.route('**/api/books/*/file-url', async (route: Route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to load book' },
        }),
      });
    });

    await page.goto(`${APP_URL}/login`);
    await login(page);
    await expect(page).toHaveURL(/\/read\/my-test-book$/);

    // Error message should be visible in the reader
    await expect(page.locator('div:has-text("Failed to load book")').first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
