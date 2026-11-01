import { test, expect, type Page } from '@playwright/test';
import { createMinimalEpub, selectReaderPassage } from './fixtures';

async function openStartChapter(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Contents', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Contents', exact: true })
    .getByRole('button', { name: 'Start', exact: true })
    .click();
}

// Runs only in the dedicated opt-in project. No API/content interception:
// exercise the Pages bundle, preview bindings and generated sample EPUB.
test.describe('Provisioned demo preview', () => {
  test.describe.configure({ mode: 'serial' });

  test('reader demo opens a real EPUB on the preview origin', async ({ page }) => {
    await page.goto('/login');
    const fileResponse = page.waitForResponse((response) => {
      return response.url().includes('/api/files/') && response.status() === 200;
    });
    await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
    await expect(page).toHaveURL(/\/read\/demo$/);
    const file = await fileResponse;
    expect(new URL(file.url()).origin).toBe(new URL(page.url()).origin);
    await openStartChapter(page);
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('iframe')?.contentDocument?.body.textContent),
      )
      .toContain('Welcome to the demo');
    const savedSecondChapter = page.waitForResponse((response) => {
      if (!response.url().endsWith('/progress') || response.request().method() !== 'PUT') {
        return false;
      }
      const body = response.request().postDataJSON() as { locator?: { cfi?: string } };
      return response.ok() && Boolean(body.locator?.cfi?.includes('/6/4'));
    });
    await page.getByRole('button', { name: 'Contents', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Contents', exact: true })
      .getByRole('button', { name: 'Try annotations', exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('iframe')?.contentDocument?.body.textContent),
      )
      .toContain('Select this sentence to add a highlight or comment.');
    await savedSecondChapter;
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('iframe')?.contentDocument?.body.textContent),
      )
      .toContain('Select this sentence to add a highlight or comment.');
  });

  test('reader display preferences reach the rendition text', async ({ page }) => {
    // Guards ADR-1018 (inline <style> must not be CSP-blocked) and the
    // epub.js select() re-injection: the open chapter must restyle immediately.
    await page.goto('/login');
    await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
    await expect(page).toHaveURL(/\/read\/demo$/);
    const fontOfChapter = () =>
      page.evaluate(() => {
        const doc = document.querySelector('iframe')?.contentDocument;
        const paragraph = doc?.querySelector('p');
        if (!paragraph || !doc?.defaultView) return null;
        return doc.defaultView.getComputedStyle(paragraph).fontSize;
      });

    await openStartChapter(page);
    await expect.poll(fontOfChapter, { timeout: 30000 }).not.toBeNull();
    const initialSize = await fontOfChapter();

    await page
      .getByRole('button', { name: /settings/i })
      .first()
      .click();
    await page
      .getByRole('button', { name: /- Large$/ })
      .first()
      .click();
    await expect.poll(fontOfChapter, { timeout: 15000 }).toBe('18px');
    expect(initialSize).not.toBe('18px');

    // Writing mode reaches the same rendered chapter (theme re-application).
    const writingModeOfChapter = () =>
      page.evaluate(() => {
        const doc = document.querySelector('iframe')?.contentDocument;
        const paragraph = doc?.querySelector('p');
        if (!paragraph || !doc?.defaultView) return null;
        return doc.defaultView.getComputedStyle(paragraph).writingMode;
      });
    await page.getByRole('button', { name: 'Vertical RTL', exact: true }).click();
    await expect.poll(writingModeOfChapter, { timeout: 15000 }).toBe('vertical-rl');
    await page.getByRole('button', { name: 'Horizontal', exact: true }).click();
    await expect.poll(writingModeOfChapter, { timeout: 15000 }).toBe('horizontal-tb');

    // Restore the default so later tests in this serial file start clean.
    await page
      .getByRole('button', { name: /- Medium$/ })
      .first()
      .click();
    await expect.poll(fontOfChapter, { timeout: 15000 }).toBe('16px');
    await expect(page.getByRole('alert').filter({ hasText: 'unexpected error' })).toHaveCount(0);
  });

  test('reader bookmark survives a reload and can be deleted', async ({ page }) => {
    // Regression for the position-only bookmark locator: the reader has no
    // selection, so it posts a CFI (+ chapter) and the API must accept it.
    await page.goto('/login');
    await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
    await expect(page).toHaveURL(/\/read\/demo$/);
    const progressSaved = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().endsWith('/progress') &&
        response.ok(),
    );
    await page.getByRole('button', { name: 'Contents', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Contents', exact: true })
      .getByRole('button', { name: 'Try annotations', exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('iframe')?.contentDocument?.body.textContent),
      )
      .toContain('Select this sentence to add a highlight or comment.');
    // The bookmark handler needs a saved progress locator.
    await progressSaved;

    await page.getByRole('button', { name: /^Bookmarks/ }).click();
    const panel = page.locator('[data-container-name="bookmarks-panel"]');
    const created = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/bookmarks') &&
        response.status() === 201,
    );
    await page.getByRole('button', { name: 'Add bookmark', exact: true }).click();
    await created;
    await expect(panel.getByRole('button', { name: 'Try annotations' })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/read\/demo$/);
    await page.getByRole('button', { name: /^Bookmarks/ }).click();
    await expect(
      page
        .locator('[data-container-name="bookmarks-panel"]')
        .getByRole('button', { name: 'Try annotations' }),
    ).toBeVisible();

    const deleted = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        /\/bookmarks\/[^/]+$/.test(new URL(response.url()).pathname) &&
        response.ok(),
    );
    await page.getByRole('button', { name: 'Delete bookmark', exact: true }).click();
    await deleted;
    await expect(
      page.locator('[data-container-name="bookmarks-panel"]').getByRole('button', {
        name: 'Try annotations',
      }),
    ).toHaveCount(0);

    await page.reload();
    await page.getByRole('button', { name: /^Bookmarks/ }).click();
    await expect(
      page.locator('[data-container-name="bookmarks-panel"]').getByRole('button', {
        name: 'Try annotations',
      }),
    ).toHaveCount(0);
  });

  test('admin creates a book and uploads its EPUB through the step-up prompt', async ({ page }) => {
    const title = `Preview Upload ${Date.now()}`;
    const epub = createMinimalEpub(
      [
        {
          id: 'c1',
          href: 'chapter1.xhtml',
          title: 'Chapter 1',
          body: '<p>UPLOADED CHAPTER BODY</p>',
        },
      ],
      { title, identifier: `urn:uuid:upload-${Date.now()}` },
    );

    await page.goto('/admin/login');
    await page.getByRole('button', { name: 'Try admin demo', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/books$/);

    await page.getByRole('button', { name: 'Create New Book', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Create New Book' });
    await modal.getByLabel('Book Title').fill(title);
    await modal.locator('input[type="file"]').setInputFiles({
      name: 'upload.epub',
      mimeType: 'application/epub+zip',
      buffer: epub,
    });

    const finalized = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/upload-complete') &&
        response.ok(),
    );
    await modal.getByRole('button', { name: 'Create Book', exact: true }).click();

    // The raw PUT is a guarded mutation: its 428 must open the password
    // prompt rather than failing the create flow.
    const stepUp = page.getByRole('dialog', { name: /Verify It/ });
    await expect(stepUp).toBeVisible();
    await stepUp.getByLabel('Current Password').fill('demo-admin-password');
    await stepUp.getByRole('button', { name: 'Confirm', exact: true }).click();

    await finalized;
    await expect(modal).not.toBeVisible();
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

    // Keep the shared preview state tidy: archive the throwaway book.
    await page.evaluate(async (bookTitle) => {
      const token = JSON.parse(localStorage.getItem('do-epub-auth') ?? '{}').state?.sessionToken;
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const list = (await (await fetch('/api/admin/books', { headers })).json()) as {
        data?: { id: string; title: string }[];
      };
      const book = list.data?.find((item) => item.title === bookTitle);
      if (book) {
        await fetch(`/api/admin/books/${book.id}`, { method: 'DELETE', headers });
      }
    }, title);
  });

  test('autofill selects the demo book before normal credential sign-in', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Fill demo credentials', exact: true }).click();
    await expect(page).toHaveURL(/\/login\?book=demo$/);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/\/read\/demo$/);
    await openStartChapter(page);
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('iframe')?.contentDocument?.body.textContent),
      )
      .toContain('Welcome to the demo');
  });

  test('reader More menu stays inside a 390px RTL viewport and signs out', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
    await expect(page).toHaveURL(/\/read\/demo$/);
    await page.getByLabel('Select language').selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.setViewportSize({ width: 390, height: 844 });

    await page.locator('button[aria-haspopup="menu"]').first().click();
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);

    const logout = page
      .locator('[role="menuitem"]')
      .filter({ hasText: /خروج|Sign out/ })
      .first();
    await expect(logout).toBeVisible();
    await logout.click();
    await expect(page).toHaveURL(/\/login\/?$/, { timeout: 15000 });
  });

  test('private feedback round-trips and reading insights export once read', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
    await expect(page).toHaveURL(/\/read\/demo$/);
    const marker = `preview-feedback-${Date.now()}`;

    // A few page turns give the device-local timer pages to record.
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(700);
    }

    await page.getByRole('button', { name: 'About This Book', exact: true }).click();
    const info = page
      .getByRole('dialog')
      .filter({ hasText: /reading insights/i })
      .last();
    await expect(info).toBeVisible();
    // Flushing on open means the panel sees the pages just read.
    await expect(info.getByText('Pages Read')).toBeVisible();
    await expect(
      info.getByRole('button', { name: 'Export Reading Insights (JSON)', exact: true }),
    ).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(info).not.toBeVisible();

    // The anchored-feedback contract: book_files ids are TEXT, not UUIDs.
    await page.getByRole('button', { name: 'Contents', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Contents', exact: true })
      .getByRole('button', { name: 'Try annotations', exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('iframe')?.contentDocument?.body.textContent),
      )
      .toContain('Select this sentence to add a highlight or comment.');
    // The selection toolbar only appears after a real passage selection.
    await selectReaderPassage(page, 'Select this sentence to add a highlight or comment.');
    await page.getByRole('button', { name: 'Private comment', exact: true }).click();
    const composer = page
      .getByRole('dialog')
      .filter({ hasText: /private feedback/i })
      .last();
    await composer.getByRole('textbox').last().fill(marker);
    const created = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/feedback$/.test(new URL(response.url()).pathname) &&
        response.ok(),
    );
    await composer.getByRole('button', { name: 'Send privately', exact: true }).click();
    expect((await created).status()).toBe(201);

    await page.getByRole('button', { name: /^Comments/ }).click();
    await page.getByRole('tab', { name: /private feedback/i }).click();
    await expect(page.getByText(marker)).toBeVisible();

    // Leave the demo state tidy: withdraw the item we created.
    const withdrawn = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/withdraw') &&
        response.ok(),
    );
    await page.getByRole('button', { name: 'Withdraw', exact: true }).first().click();
    await withdrawn;
  });

  test('an unauthenticated reader deep link keeps its book context', async ({ page }) => {
    await page.goto('/read/demo');
    await expect(page).toHaveURL(/\/login\?book=demo$/);
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeEnabled();
  });

  test('explicitly enabled preview administrator can enter the demo', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByRole('button', { name: 'Try admin demo', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/books/);
    await expect(page.getByRole('heading', { name: 'Your Books', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Demo Book', exact: true })).toBeVisible();
  });
});
