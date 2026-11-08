import { expect, test, type Page, type Route } from '@playwright/test';
import { loginAsAdmin } from './fixtures';

async function mockAuthoringApi(
  page: Page,
  initialChapter: { title: string; contentHtml: string } = {
    title: 'Chapter 1',
    contentHtml: '<p>Initial chapter text.</p>',
  },
) {
  let draftVersion = 1;
  let currentPublication = {
    title: 'Authoring E2E Book',
    authorName: 'Ada Lovelace',
    language: 'en',
    description: 'An E2E test publication',
    chapters: [
      {
        id: 'chapter-1',
        title: initialChapter.title,
        order: 0,
        contentHtml: initialChapter.contentHtml,
      },
    ],
  };

  await page.route('**/api/admin/login', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          token: 'admin-test-token',
          user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
        },
      }),
    });
  });

  await page.route('**/api/admin/books', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: [
          {
            id: 'book-author-1',
            slug: 'author-e2e-book',
            title: 'Authoring E2E Book',
            authorName: 'Ada Lovelace',
            description: 'An E2E test publication',
            language: 'en',
            visibility: 'private',
            coverImageUrl: null,
            publishedAt: null,
          },
        ],
      }),
    });
  });

  await page.route('**/api/author/books', async (route: Route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { title: string; slug: string };
      currentPublication.title = body.title;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            bookId: 'book-author-1',
            slug: body.slug,
            title: body.title,
            draftVersion: 1,
            publication: currentPublication,
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/author/books/*/manuscript', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            bookId: 'book-author-1',
            publication: currentPublication,
            draftVersion,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      return;
    }

    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as {
        publication: typeof currentPublication;
        expectedVersion?: number;
      };
      draftVersion += 1;
      currentPublication = body.publication;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            bookId: 'book-author-1',
            publication: currentPublication,
            draftVersion,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/author/books/*/publish', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            bookId: 'book-author-1',
            fileId: 'file-published-1',
            revision: 1,
            sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            fileSize: 4096,
            status: 'published',
          },
        }),
      });
      return;
    }
    await route.continue();
  });
}

test.describe('EPUB Authoring Workspace and Publishing Pipeline', () => {
  test('author can create a book from scratch, edit chapters, preview, and publish as EPUB 3', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium and WebKit authoring baseline',
    );

    await mockAuthoringApi(page);
    await loginAsAdmin(page);

    // 1. Open Create Book modal
    await page.getByRole('button', { name: /Create.*Book/i }).click();
    await expect(page.getByRole('dialog', { name: /Create.*Book/i })).toBeVisible();

    // 2. Select "Author from Scratch" mode
    await page.getByRole('button', { name: 'Author from Scratch' }).click();
    await page.getByLabel(/Book Title/i).fill('Authoring E2E Book');
    await page.getByLabel(/Author/i).fill('Ada Lovelace');

    // 3. Submit to create publication and navigate to author workspace
    await page.getByRole('button', { name: 'Create Manuscript' }).click();
    await expect(page).toHaveURL(/\/admin\/books\/book-author-1\/author/, { timeout: 15000 });

    // 4. In author workspace: verify header and chapter editor
    await expect(page.getByRole('heading', { level: 1, name: 'Authoring E2E Book' })).toBeVisible();
    await expect(page.getByText('Saved')).toBeVisible();

    // 5. Edit chapter title and content
    const titleInput = page.getByLabel('Chapter Title');
    await titleInput.fill('Prologue: The Awakening');

    const contentEditor = page.getByLabel('Content (Semantic XHTML)');
    await contentEditor.fill('<p>A new chapter in digital publishing begins.</p>');

    // 6. Add a second chapter
    await page.getByRole('button', { name: '+ Add' }).click();
    await expect(page.getByText('Chapters (2)')).toBeVisible();

    // 7. Switch to Preview tab
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(
      page.getByText('Previewing with production reader typography and semantic styling.'),
    ).toBeVisible();

    // 8. Open Publish Modal and publish
    await page.getByRole('button', { name: 'Publish as EPUB 3' }).click();
    await expect(page.getByRole('dialog', { name: 'Publish EPUB 3 Publication' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm & Publish' }).click();

    // 9. Verify publication success banner with revision and hash
    await expect(page.getByText('Publication Published!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Revision #1/)).toBeVisible();
    await expect(page.getByText(/SHA-256:/)).toBeVisible();
  });
  test('renders hostile chapter content as safe React preview nodes', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium and WebKit authoring baseline',
    );

    const hostileTitle = '<img src="x" onerror="run()">';
    const hostileContent = [
      '<p onclick="run()">Safe chapter text.</p>',
      '<script>run()</script >',
      '<iframe src="https://evil.example">Frame text</iframe>',
      '<a href="jav&#x61;script:run()">Unsafe link</a>',
      '<img src="https://evil.example/image.png" onerror="run()" alt="Remote image">',
      '<svg onload="run()"><script>run()</script></svg>',
    ].join('');

    await mockAuthoringApi(page, { title: hostileTitle, contentHtml: hostileContent });
    await loginAsAdmin(page);
    await page.goto('/admin/books/book-author-1/author');
    await expect(page).toHaveURL(/\/admin\/books\/book-author-1\/author/);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();

    const article = page.locator('article');
    await expect(article.locator('h1')).toHaveText(hostileTitle);
    await expect(article).toContainText('Safe chapter text.');
    await expect(article.locator('script, iframe, svg, style')).toHaveCount(0);
    await expect(
      article.locator('[onclick], [onerror], [src^="https://evil.example"], [href^="javascript:"]'),
    ).toHaveCount(0);
    await expect(article.locator('img')).toHaveCount(1);
    await expect(article.locator('img')).not.toHaveAttribute('src');
    await expect(article.locator('a')).toHaveText('Unsafe link');
    await expect(article.locator('a')).not.toHaveAttribute('href');
  });
});
