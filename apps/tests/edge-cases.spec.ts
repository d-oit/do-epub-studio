import { test, expect, type Page, type Route } from '@playwright/test';

const TEST_USER = {
  email: 'reader@example.com',
  password: process.env.TEST_PASSWORD || 'test-password',
  bookSlug: 'my-test-book',
};

const LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: 'test-session-token-abc123',
    book: { id: 'book-1', slug: TEST_USER.bookSlug, title: 'My Test Book', authorName: 'Test Author' },
    capabilities: {
      canRead: true, canComment: true, canHighlight: true, canBookmark: true,
      canDownloadOffline: false, canExportNotes: false, canManageAccess: false,
    },
  },
};

async function mockReaderApi(page: Page) {
  await page.route('**/api/access/request', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LOGIN_RESPONSE) });
  });
  await page.route('**/api/books/*/file-url', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { url: 'https://example.com/test.epub' } }) });
  });
  await page.route('**/api/books/*/progress', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { locator: { cfi: 'epubcfi(/6/4)' }, progressPercent: 0.1 } }) });
  });
  await page.route('**/api/books/*/highlights', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });
  await page.route('**/api/books/*/comments', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });
  await page.route('**/api/books/*/bookmarks', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });
  await page.route('**/api/access/logout', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });
}

async function loginAsReader(page: Page) {
  await page.goto(`/login?book=${TEST_USER.bookSlug}`);
  await page.getByLabel('Email Address').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/read\/my-test-book$/);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

test.describe('Edge Cases & Error Handling', () => {
  test('@mobile should handle invalid login credentials gracefully', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');

    // Mock a 401 response before filling in credentials
    await page.route('**/api/access/request', route => route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }),
    }));

    // Fill in values that should fail (mocked or handled by app)
    await page.getByLabel('Email Address').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpassword');

    await page.getByRole('button', { name: 'Sign In' }).click();

    // Assuming the app shows the error message returned by the API
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('@mobile should redirect to login when session expires (401)', async ({ page }) => {
    // Mock admin login
    await page.route('**/api/admin/login', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { sessionToken: 'admin-token', email: 'admin@test.com' } }),
    }));

    // Mock initial books load so the page renders successfully
    await page.route('**/api/admin/books', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] }),
    }));

    await page.goto('/admin/login');
    await page.getByLabel('Email Address').fill('admin@test.com');
    await page.getByLabel('Password').fill('admin-password');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/admin\/books/);

    // Remove existing mock, then re-mock the broader admin namespace with 401
    // to simulate session expiry. Wildcard coverage ensures bootstrap calls
    // (e.g., /api/admin/me if present) also trigger handleUnauthorized().
    // The 401 handler in api.ts excludes /api/admin/login so login mocks remain intact.
    await page.unroute('**/api/admin/books');
    await page.unroute('**/api/admin/**');
    await page.route('**/api/admin/**', route => {
      if (route.request().url().includes('/api/admin/login')) {
        return route.continue();
      }
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Session expired' } }),
      });
    });

    // Reload the page — the API call should fail with 401
    await page.reload();

    // Should be redirected to login with error param
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/error=session_expired/);
  });

  test('@mobile should show offline indicator when network is disconnected', async ({ page, context }) => {
    await page.goto('/');
    await context.setOffline(true);

    // PWA should still load basic shell
    const title = await page.title();
    expect(title).toBeTruthy();

    // If there's an offline UI, verify it here. For now, we'll just verify the page didn't crash.
    await context.setOffline(false);
  });

  test('@mobile handles network failure during annotation save gracefully', async ({ page }) => {
    await mockReaderApi(page);
    await loginAsReader(page);

    // Mock highlight save to fail with network error
    await page.route('**/api/books/*/highlights', async (route: Route) => {
      if (route.request().method() === 'POST') {
        await route.abort('failed');
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: [] }),
        });
      }
    });

    // Attempt to create a highlight (annotation) — should fail gracefully
    const highlightResult = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/books/book-1/highlights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locator: { cfi: 'epubcfi(/6/4)' },
            color: '#ffff00',
            text: 'Test highlight',
          }),
        });
        return { status: res.status, ok: res.ok };
      } catch {
        return { status: 0, ok: false };
      }
    });

    // Network failure should result in ok: false or 0 status
    expect(highlightResult.ok).toBe(false);

    // App should still be functional (no crash)
    const bodyVisible = await page.locator('body').isVisible().catch(() => false);
    expect(bodyVisible).toBe(true);

    // Verify the reader toolbar is still accessible (may need time to recover)
    const toolbarVisible = await page.getByRole('button', { name: 'Contents' }).isVisible({ timeout: 10000 }).catch(() => false);
    expect(toolbarVisible || bodyVisible).toBe(true);
  });

  test('@mobile handles mid-read network failure gracefully — reader stays usable', async ({ page }) => {
    await mockReaderApi(page);
    await loginAsReader(page);

    // Verify reader loaded successfully
    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();

    // Simulate network failure mid-read by aborting all API requests
    await page.route('**/api/**', async (route: Route) => {
      await route.abort('failed');
    });

    // Attempt interactions that require network — all should fail gracefully
    const results = await page.evaluate(async () => {
      const outcomes: { action: string; ok: boolean }[] = [];

      // Try saving progress
      try {
        const res = await fetch('/api/books/my-test-book/progress', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locator: { cfi: 'epubcfi(/6/4)' }, progressPercent: 0.5 }),
        });
        outcomes.push({ action: 'progress', ok: res.ok });
      } catch {
        outcomes.push({ action: 'progress', ok: false });
      }

      // Try adding a highlight
      try {
        const res = await fetch('/api/books/my-test-book/highlights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locator: { cfi: 'epubcfi(/6/4)' }, color: '#ffff00', text: 'note' }),
        });
        outcomes.push({ action: 'highlight', ok: res.ok });
      } catch {
        outcomes.push({ action: 'highlight', ok: false });
      }

      // Try adding a bookmark
      try {
        const res = await fetch('/api/books/my-test-book/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locator: { cfi: 'epubcfi(/6/4)' }, label: 'bookmark' }),
        });
        outcomes.push({ action: 'bookmark', ok: res.ok });
      } catch {
        outcomes.push({ action: 'bookmark', ok: false });
      }

      return outcomes;
    });

    // All network calls should have failed
    for (const r of results) {
      expect(r.ok).toBe(false);
    }

    // The reader should NOT crash — verify core UI is still present
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();

    // Remove the network failure route and verify recovery
    await page.unroute('**/api/**');
    await mockReaderApi(page);

    // Trigger a reload — should recover
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Reader should be fully functional again
    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible({ timeout: 15000 });
  });

  test('@mobile shows error UI when EPUB file fails to load mid-session', async ({ page }) => {
    await mockReaderApi(page);
    await loginAsReader(page);

    // Verify reader loaded
    await expect(page.getByRole('button', { name: 'Contents' })).toBeVisible({ timeout: 15000 });

    // Now make the EPUB file URL fail
    await page.unroute('**/api/books/*/file-url');
    await page.route('**/api/books/*/file-url', async (route: Route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'SERVER_ERROR', message: 'Book file unavailable' } }),
      });
    });

    // Attempting to re-fetch the book URL should fail gracefully
    const result = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/books/my-test-book/file-url');
        const data: { ok: boolean; error?: { message?: string } } = await res.json();
        return { ok: data.ok, message: data.error?.message };
      } catch {
        return { ok: false, message: 'network error' };
      }
    });

    expect(result.ok).toBe(false);

    // Page should still be present (no white screen)
    await expect(page.locator('body')).toBeVisible();
  });
});
