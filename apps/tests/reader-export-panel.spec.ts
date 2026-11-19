import { test, expect, type Page } from '@playwright/test';
import {
  MOCK_EPUB,
  clickToolbarButton,
  loginAsReader,
  mockReaderApi,
  suppressWorkboxErrors,
} from './fixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openExportPanel(page: Page) {
  await clickToolbarButton(page, 'Export Notes');
  await expect(page.getByRole('dialog', { name: /Export annotations/i })).toBeVisible();
}

async function selectFormat(page: Page, format: 'markdown' | 'html' | 'epub') {
  await page.getByLabel('Format').selectOption(format);
}

// ---------------------------------------------------------------------------
// Desktop
// ---------------------------------------------------------------------------

test.describe('Reader export panel — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    suppressWorkboxErrors(page);
    await mockReaderApi(page, { epubUrl: '/test-book.epub', epubBuffer: MOCK_EPUB });
    await loginAsReader(page);
  });

  test('opening export closes another panel, and another panel closes export', async ({ page }) => {
    await page.getByRole('button', { name: /Contents/i }).click();
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();

    await openExportPanel(page);
    await expect(page.getByRole('heading', { name: 'Contents' })).not.toBeVisible();

    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('dialog', { name: /Export annotations/i })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
  });

  test('focus enters the panel and Escape returns it to the export trigger', async ({ page }) => {
    await page.getByRole('button', { name: 'Export Notes' }).click();
    await expect(page.getByRole('dialog', { name: /Export annotations/i })).toBeVisible();
    await expect(page.locator('#reader-export-panel select')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Export annotations/i })).not.toBeVisible();
    await expect(page.locator('#reader-export-trigger')).toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// Mobile
// ---------------------------------------------------------------------------

test.describe('Reader export panel — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    suppressWorkboxErrors(page);
    await mockReaderApi(page, { epubUrl: '/test-book.epub', epubBuffer: MOCK_EPUB });
    await loginAsReader(page);
  });

  test('@mobile Markdown stays available offline while server formats are blocked', async ({
    page,
    context,
  }) => {
    // Go offline after login; the reader surfaces the offline state.
    await context.setOffline(true);
    await expect(page.getByText('Offline')).toBeVisible();

    await openExportPanel(page);
    const htmlOption = page.locator('#reader-export-panel option[value="html"]');
    const epubOption = page.locator('#reader-export-panel option[value="epub"]');
    await expect(htmlOption).toBeDisabled();
    await expect(epubOption).toBeDisabled();
    await expect(page.getByText(/require an internet connection/i)).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.md');
    await expect(page.getByRole('dialog', { name: /Export annotations/i })).not.toBeVisible();
  });

  test('@mobile downloads an EPUB and closes the panel', async ({ page }) => {
    await page.route('**/api/books/*/export?format=epub', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/epub+zip',
        headers: { 'Content-Disposition': 'attachment; filename="server-annotations.epub"' },
        body: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      });
    });

    await openExportPanel(page);
    await selectFormat(page, 'epub');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.epub');
    await expect(page.getByRole('dialog', { name: /Export annotations/i })).not.toBeVisible();
  });

  test('@mobile closing the panel during export cancels and leaves no stale busy state', async ({
    page,
  }) => {
    const downloads: string[] = [];
    page.on('download', (download) => downloads.push(download.suggestedFilename()));

    await page.route('**/api/books/*/export?format=epub', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        await route.fulfill({
          status: 200,
          contentType: 'application/epub+zip',
          body: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        });
      } catch {
        // Request was aborted by the panel close — expected.
      }
    });

    await openExportPanel(page);
    await selectFormat(page, 'epub');
    await page.getByRole('button', { name: 'Download' }).click();
    await expect(page.getByText(/Preparing download/i)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Export annotations/i })).not.toBeVisible();
    await page.waitForTimeout(600);
    expect(downloads).toHaveLength(0);

    // Reopening shows a fresh, idle panel: no stuck spinner, no stale error.
    await openExportPanel(page);
    await expect(page.getByText(/Preparing download/i)).not.toBeVisible();
    await expect(page.getByRole('alert')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled();
  });

  test('@smoke @mobile keyboard journey: open panel, download Markdown, focus returns to overflow trigger', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /More [Oo]ptions/i }).click();
    const exportItem = page
      .locator('.cq-reader-toolbar-overflow')
      .getByRole('menuitem', { name: 'Export Notes' });
    await exportItem.click();
    await expect(page.getByRole('dialog', { name: /Export annotations/i })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).press('Enter');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.md');
    await expect(page.getByRole('dialog', { name: /Export annotations/i })).not.toBeVisible();
    await expect(page.locator('#reader-overflow-trigger')).toBeFocused();
  });
});
