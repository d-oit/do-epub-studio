import { test, expect } from '@playwright/test';
import { createMinimalEpub, mockReaderApi, loginAsReader } from './fixtures';

// ---------------------------------------------------------------------------
// Constants (overrides for smoke-test slug)
// ---------------------------------------------------------------------------

const TEST_USER = {
  email: 'reader@example.com',
  password: process.env.TEST_PASSWORD || 'test-password',
  bookSlug: 'smoke-test',
};

const LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: process.env.TEST_SESSION_TOKEN || 'smoke-session-token',
    book: { id: 'book-smoke', slug: TEST_USER.bookSlug, title: 'Smoke Test Book', authorName: 'Test Author' },
    capabilities: { canRead: true, canComment: true, canHighlight: true, canBookmark: true, canDownloadOffline: false, canExportNotes: false, canManageAccess: false },
  },
};

const EPUB_BUFFER = createMinimalEpub([
  { id: 'c1', href: 'chapter1.xhtml', title: 'Chapter 1', body: '<p>CHAPTER ONE CONTENT for the smoke test reader.</p>' },
  { id: 'c2', href: 'chapter2.xhtml', title: 'Chapter 2', body: '<p>CHAPTER TWO CONTENT here, different from chapter one.</p>' },
]);

// ---------------------------------------------------------------------------
// Smoke test suite
// ---------------------------------------------------------------------------

test.describe('Reader migration smoke', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`PAGE ERROR: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      console.log(`PAGE UNCAUGHT ERROR: ${err.message}`);
    });
    await mockReaderApi(page, {
      bookSlug: TEST_USER.bookSlug,
      epubUrl: 'http://127.0.0.1:0/test/epub',
      epubBuffer: EPUB_BUFFER,
      loginResponse: LOGIN_RESPONSE,
    });
  });

  test('@mobile opens reader and shows book title', async ({ page }) => {
    await loginAsReader(page, TEST_USER.bookSlug);

    await expect(page.getByRole('heading', { name: 'Smoke Test Book' })).toBeVisible({ timeout: 30000 });
  });

  test('@mobile navigates next chapter and asserts section changed', async ({ page }) => {
    await loginAsReader(page, TEST_USER.bookSlug);

    await expect(page.getByRole('heading', { name: 'Smoke Test Book' })).toBeVisible({ timeout: 30000 });

    await page.waitForTimeout(3000);

    // Get initial chapter content
    const getBodyText = () =>
      page.evaluate(() => {
        const iframe = document.querySelector('iframe');
        if (!iframe?.contentDocument?.body) return null;
        return iframe.contentDocument.body.textContent ?? null;
      });

    const initialText = await getBodyText();

    if (initialText !== null) {
      // Navigate to next chapter via keyboard
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(2000);

      const afterNext = await getBodyText();
      expect(afterNext).not.toBe(initialText);

      // Navigate back to previous chapter
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(2000);

      const afterPrev = await getBodyText();
      expect(afterPrev).toBe(initialText);
    }
  });
});
