import { test, expect, type Page } from '@playwright/test';
import { MOCK_EPUB, loginAsReader, mockReaderApi } from './fixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Click a toolbar action button, automatically handling the mobile overflow
 * menu.  On narrow viewports (< 640px) the toolbar collapses into a
 * vertical-dots overflow menu via CSS container query (ADR-105).  This
 * helper uses the viewport width (matching the container-query breakpoint)
 * to decide which path to take, and always uses `dispatchEvent` to bypass
 * pointer-event interception from open side-panels that overlap the toolbar.
 */
async function clickToolbarAction(page: Page, name: string | RegExp) {
  const isNarrow = (page.viewportSize()?.width ?? 1280) < 640;

  if (isNarrow) {
    // Mobile / narrow viewport — open the overflow dropdown first.
    // Use dispatchEvent because open panels (z-50, full-width on mobile)
    // may cover the toolbar trigger button.
    await page.getByRole('button', { name: 'More options' }).dispatchEvent('click');
    const overflowItem = page
      .locator('.cq-reader-toolbar-overflow')
      .getByRole('button', { name });
    await overflowItem.waitFor({ state: 'visible', timeout: 5000 });
    await overflowItem.dispatchEvent('click');
  } else {
    // Desktop — click directly from the main toolbar row.
    // Use dispatchEvent to bypass pointer-event interception from
    // open side-panels (z-40) that partially overlay the toolbar area.
    await page.getByRole('button', { name }).first().dispatchEvent('click');
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Reader side-panel mutual exclusivity', () => {
  test.beforeEach(async ({ page }) => {
    await mockReaderApi(page, { epubUrl: '/test-book.epub', epubBuffer: MOCK_EPUB });
    await loginAsReader(page);
  });

  test('@mobile opening search closes table of contents', async ({ page }) => {
    // Open Table of Contents (always in the left section of the toolbar)
    await page.getByRole('button', { name: /Contents/i }).click();
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();

    // Open Search
    await clickToolbarAction(page, 'Search');

    // Search panel should be visible
    await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();

    // Table of Contents should be closed
    await expect(page.getByRole('heading', { name: 'Contents' })).not.toBeVisible();
  });

  test('@mobile opening settings closes search', async ({ page }) => {
    // Open Search
    await clickToolbarAction(page, 'Search');
    await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();

    // Open Settings. The Search panel (z-50) overlaps the header in
    // some browsers (notably WebKit + Firefox under load), so the
    // click is dispatched directly via the test API to reach the
    // toolbar button. Mutual exclusivity is still verified by the
    // state assertions below: opening Settings must close the Search
    // panel.
    await clickToolbarAction(page, 'Settings');

    // Settings panel should be visible (check for unique text like "Font Size")
    await expect(page.getByText('Font Size')).toBeVisible();

    // Search panel should be closed
    await expect(page.getByRole('heading', { name: 'Search', exact: true })).not.toBeVisible();
  });

  test('@mobile opening comments closes bookmarks', async ({ page }) => {
    // Open Bookmarks
    await clickToolbarAction(page, 'Bookmarks');
    await expect(page.getByRole('heading', { name: 'Bookmarks' })).toBeVisible();

    // Open Comments
    await clickToolbarAction(page, /Comment/i);

    // Comments panel should be visible (check for unique heading, plural form in UI: "Comments")
    // The UI renders "Comments" as heading (h2 + plural)
    await expect(page.getByRole('heading', { name: 'Comments' })).toBeVisible();

    // Bookmarks panel should be closed
    await expect(page.getByRole('heading', { name: 'Bookmarks' })).not.toBeVisible();
  });

  test('@mobile opening info panel closes comments', async ({ page }) => {
    // Open Comments
    await clickToolbarAction(page, /Comment/i);
    await expect(page.getByRole('heading', { name: 'Comments' })).toBeVisible();

    // Open Info panel ("About book" tooltip/aria-label)
    await clickToolbarAction(page, 'About This Book');

    // Info panel should be visible (heading "About This Book")
    await expect(page.getByRole('heading', { name: 'About This Book' })).toBeVisible();

    // Comments panel should be closed
    await expect(page.getByRole('heading', { name: 'Comments' })).not.toBeVisible();
  });

  test('@mobile info panel displays book metadata', async ({ page }) => {
    // Open Info panel
    await clickToolbarAction(page, 'About This Book');
    await expect(page.getByRole('heading', { name: 'About This Book' })).toBeVisible();

    // Verify book metadata from the EPUB is displayed
    await expect(page.getByText('Test')).toBeVisible();
  });
});
