import { test, expect, type Page, type Route } from '@playwright/test';
import { suppressWorkboxErrors } from './fixtures';

async function seedCreatorAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'do-epub-auth',
      JSON.stringify({
        state: {
          sessionToken: 'creator-session-token',
          sessionExpiresAt: Date.now() + 86400000,
          bookId: 'book-1',
          bookSlug: 'test-book',
          bookTitle: 'Test Book',
          email: 'creator@example.com',
          capabilities: {
            canRead: true,
            canComment: true,
            canHighlight: true,
            canBookmark: true,
            canDownloadOffline: true,
            canExportNotes: true,
            canManageAccess: false,
          },
          isAuthenticated: true,
          isAdmin: false,
          sessionExpired: false,
        },
        version: 0,
      }),
    );
  });
}

test.describe('E3: Creator workspace route browser coverage', () => {
  test.beforeEach(async ({ page }) => {
    suppressWorkboxErrors(page);
    await seedCreatorAuth(page);
  });

  test('assignment-gated navigation and book listing on /creator', async ({ page }) => {
    await page.route('**/api/creator/books', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: [{ id: 'book-1', slug: 'test-book', title: 'The Great Creator Novel' }],
        }),
      });
    });

    await page.goto('/creator');

    // Heading and assigned books list visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('The Great Creator Novel')).toBeVisible();

    // Clicking book link navigates to feedback workspace
    await page.getByRole('link', { name: 'The Great Creator Novel' }).click();
    await expect(page).toHaveURL(/\/creator\/books\/book-1\/feedback$/);
  });

  test('direct workspace reload and feedback provenance labels', async ({ page }) => {
    await page.route('**/api/creator/books', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: [{ id: 'book-1', slug: 'test-book', title: 'The Great Creator Novel' }],
        }),
      });
    });
    await page.route('**/api/creator/books/book-1/feedback', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: [
            {
              id: 'fb-1',
              bookId: 'book-1',
              kind: 'suggestion',
              category: 'grammar',
              status: 'open',
              anchor: {
                chapterRef: 'chap01.xhtml',
                cfi: '/6/4[chap01]!/4/2',
                selectedText: 'Some questionable sentence',
              },
              body: 'Needs rephrasing for flow.',
              proposedText: 'A much better sentence for flow.',
              replyCount: 0,
              replies: [],
              createdAt: '2026-10-04T12:00:00Z',
              updatedAt: '2026-10-04T12:00:00Z',
            },
          ],
        }),
      });
    });

    await page.route('**/api/creator/books/book-1/references**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [] }),
      });
    });
    await page.route('**/api/creator/books/book-1/style**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: null }),
      });
    });
    await page.route('**/api/creator/books/book-1/assistance-consent**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { consentGiven: false } }),
      });
    });

    // Direct goto /creator/books/book-1/feedback
    await page.goto('/creator/books/book-1/feedback');

    // Title displayed from session or loaded books
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Needs rephrasing for flow.')).toBeVisible();

    // Feedback anchor and proposed text visible
    await expect(page.getByText('Some questionable sentence')).toBeVisible();

    // Reload page directly and verify state survives
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Needs rephrasing for flow.')).toBeVisible();
  });

  test('unassigned state and visible error alert on 403', async ({ page }) => {
    // Empty assigned books: renders empty unassigned state
    await page.route('**/api/creator/books', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [] }),
      });
    });

    await page.goto('/creator');
    await expect(page.locator('text=/unassigned|not assigned|no books/i')).toBeVisible();

    // 403 error: renders error alert and retry button
    await page.route('**/api/creator/books', async (route: Route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { message: 'Not authorized as creator' } }),
      });
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  });
});
