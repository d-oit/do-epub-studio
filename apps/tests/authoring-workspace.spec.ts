import { Buffer } from 'node:buffer';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import type { AuthorAssetMetadata, AuthorPublication } from '@do-epub-studio/shared';
import { loginAsAdmin } from './fixtures';

const BOOK_ID = 'book-author-1';
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==',
  'base64',
);

const CSS_BYTES = Buffer.from('p { color: #123456; text-align: justify; }', 'utf8');
const ASSET_UPLOAD_FIXTURES = new Map<string, Buffer>([
  ['diagram.png', PNG_BYTES],
  ['book.css', CSS_BYTES],
]);

async function mockAuthoringApi(page: Page) {
  let draftVersion = 1;
  let publication: AuthorPublication = {
    title: 'Authoring E2E Book',
    creators: ['Ada Lovelace'],
    language: 'en',
    identifier: 'urn:uuid:authoring-e2e',
    description: 'An E2E test publication',
    publisher: '',
    rights: '',
    coverImageAssetId: null,
    stylesheetAssetIds: [],
    chapters: [
      {
        id: 'chapter-1',
        title: 'Chapter 1',
        order: 0,
        contentHtml: '<p>Initial chapter text.</p>',
      },
    ],
  };
  const assets: AuthorAssetMetadata[] = [];
  const assetContents = new Map<string, Buffer>();
  const assetIds = new Map<string, string>();
  let publishedPublication: AuthorPublication | null = null;

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
      json: {
        ok: true,
        data: [
          {
            id: BOOK_ID,
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
      },
    });
  });

  await page.route('**/api/author/books', async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    const body = route.request().postDataJSON() as {
      title: string;
      authorName?: string;
      slug: string;
    };
    publication = {
      ...publication,
      title: body.title,
      creators: body.authorName ? [body.authorName] : publication.creators,
    };
    await route.fulfill({
      status: 201,
      json: {
        ok: true,
        data: {
          bookId: BOOK_ID,
          slug: body.slug,
          title: body.title,
          draftVersion,
          publication,
        },
      },
    });
  });

  await page.route('**/api/author/books/*/manuscript', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          ok: true,
          data: {
            bookId: BOOK_ID,
            bookSlug: 'author-e2e-book',
            publication,
            draftVersion,
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      });
      return;
    }

    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { publication: AuthorPublication };
      draftVersion += 1;
      publication = body.publication;
      await route.fulfill({
        json: {
          ok: true,
          data: {
            bookId: BOOK_ID,
            bookSlug: 'author-e2e-book',
            publication,
            draftVersion,
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/author/books/*/assets**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const assetId = path.endsWith('/assets')
      ? null
      : decodeURIComponent(path.split('/').at(-1) ?? '');

    if (request.method() === 'GET' && assetId === null) {
      await route.fulfill({ json: { ok: true, data: { assets } } });
      return;
    }

    if (request.method() === 'PUT' && assetId) {
      const contentType = request.headers()['content-type'] ?? 'application/octet-stream';
      const name = decodeURIComponent(request.headers()['x-asset-name'] ?? 'asset');
      const requestBody = request.postDataBuffer();
      const data =
        requestBody?.byteLength && requestBody.byteLength > 0
          ? requestBody
          : (ASSET_UPLOAD_FIXTURES.get(name) ?? Buffer.alloc(0));
      const asset: AuthorAssetMetadata = {
        id: assetId,
        name,
        mediaType: contentType as AuthorAssetMetadata['mediaType'],
        sizeBytes: data.byteLength,
        sha256: '0'.repeat(64),
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      assets.push(asset);
      assetIds.set(name, assetId);
      assetContents.set(assetId, data);
      await route.fulfill({ json: { ok: true, data: { asset } } });
      return;
    }

    if (request.method() === 'GET' && assetId) {
      const asset = assets.find((item) => item.id === assetId);
      const data = assetContents.get(assetId);
      if (!asset || !data) {
        await route.fulfill({ status: 404, json: { ok: false, error: { code: 'NOT_FOUND' } } });
        return;
      }
      await route.fulfill({ contentType: asset.mediaType, body: data });
      return;
    }

    if (request.method() === 'DELETE' && assetId) {
      const index = assets.findIndex((asset) => asset.id === assetId);
      if (index !== -1) assets.splice(index, 1);
      assetContents.delete(assetId);
      await route.fulfill({ json: { ok: true, data: { deleted: true } } });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/author/books/*/publish', async (route: Route) => {
    publishedPublication = JSON.parse(JSON.stringify(publication)) as AuthorPublication;
    await route.fulfill({
      status: 201,
      json: {
        ok: true,
        data: {
          bookId: BOOK_ID,
          fileId: 'file-published-1',
          revision: 1,
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          fileSize: 4096,
          status: 'published',
        },
      },
    });
  });

  return {
    getAssetId: (name: string) => assetIds.get(name),
    getPublishedPublication: () => publishedPublication,
  };
}

test.describe('EPUB authoring workspace and publishing pipeline', () => {
  test('creates, edits, previews, and publishes an asset-backed EPUB 3 manuscript accessibly', async ({
    page,
  }) => {
    const mock = await mockAuthoringApi(page);
    await loginAsAdmin(page);

    await page.getByRole('button', { name: /Create.*Book/i }).click();
    const createDialog = page.getByRole('dialog', { name: 'Create New Book' });
    await expect(createDialog).toBeVisible();
    await createDialog.getByRole('button', { name: 'Author from scratch' }).click();
    await createDialog.getByLabel('Book Title').fill('Authoring E2E Book');
    await createDialog.getByLabel('Author Name').fill('Ada Lovelace');
    await createDialog.getByLabel('Manuscript template').selectOption('blank');
    await createDialog.getByRole('button', { name: 'Create manuscript' }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/books/${BOOK_ID}/author`), {
      timeout: 15000,
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Authoring E2E Book' })).toBeVisible();
    await expect(page.getByText('Saved')).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);

    const addChapter = page.getByRole('button', { name: 'Add chapter' });
    await addChapter.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Manuscript chapters (2)' })).toBeVisible();
    await page.getByRole('button', { name: 'Move Chapter 2 up' }).click();

    const chapterTitle = page.getByLabel('Chapter title');
    await chapterTitle.fill('Prologue: The Awakening');
    const contentEditor = page.getByLabel('Content (Semantic XHTML)');
    await contentEditor.fill('<h2>Reader preview heading</h2><p>A new chapter begins.</p>');

    await page.getByLabel('Choose an image or stylesheet').setInputFiles({
      name: 'diagram.png',
      mimeType: 'image/png',
      buffer: PNG_BYTES,
    });
    await page.getByRole('button', { name: 'Upload asset' }).click();
    await expect(page.getByText('diagram.png', { exact: true })).toBeVisible();
    const imageAssetId = mock.getAssetId('diagram.png');
    expect(imageAssetId).toBeTruthy();
    await page.getByRole('button', { name: 'Insert diagram.png in chapter' }).click();
    await expect(contentEditor).toHaveValue(new RegExp(`asset:${imageAssetId}`));

    await page.getByLabel('Choose an image or stylesheet').setInputFiles({
      name: 'book.css',
      mimeType: 'text/css',
      buffer: CSS_BYTES,
    });
    await page.getByRole('button', { name: 'Upload asset' }).click();
    const stylesheet = page.getByRole('checkbox', { name: 'Use book.css as a stylesheet' });
    await expect(stylesheet).toBeVisible();
    await stylesheet.check();

    await page.getByRole('button', { name: 'Metadata' }).click();
    const metadataDialog = page.getByRole('dialog', { name: 'Publication metadata' });
    await metadataDialog.getByLabel('Publication title').fill('Authoring E2E Book');
    await metadataDialog.getByLabel('Creators').fill('Ada Lovelace\nAugusta King');
    await metadataDialog.getByLabel('Language (BCP 47)').fill('en-GB');
    await expect(metadataDialog.getByLabel('Language (BCP 47)')).toHaveValue('en-GB');
    await metadataDialog.getByLabel('Identifier').fill('urn:uuid:authoring-e2e-final');
    await metadataDialog
      .getByLabel('Description')
      .fill('A finished publication with local assets.');
    await metadataDialog.getByLabel('Publisher').fill('Analytical Press');
    await metadataDialog.getByLabel('Rights').fill('Public Domain');
    await metadataDialog.getByLabel('Cover image').selectOption(imageAssetId!);
    await expect(metadataDialog.getByLabel('Language (BCP 47)')).toHaveValue('en-GB');
    await expect(metadataDialog.getByLabel('Identifier')).toHaveValue(
      'urn:uuid:authoring-e2e-final',
    );
    await metadataDialog.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(
      page.getByText('This EPUB preview uses the production reader and sanitizer.'),
    ).toBeVisible();
    const preview = page.getByTestId('author-epub-preview');
    await expect(preview).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
    await expect(preview.locator('iframe')).toHaveAttribute('title', 'EPUB reader preview');
    const previewFrameSize = await preview.locator('iframe').evaluate((iframe) => {
      const { width, height } = iframe.getBoundingClientRect();
      return { width, height };
    });
    expect(previewFrameSize.width).toBeGreaterThan(200);
    expect(previewFrameSize.height).toBeGreaterThan(200);
    const readerFrame = page.frameLocator('[data-testid="author-epub-preview"] iframe');
    await expect(readerFrame.locator('body')).toContainText('Reader preview heading');
    const renderedImage = readerFrame.locator('img');
    await expect(renderedImage).toHaveCount(1);
    const imageDetails = await renderedImage.evaluate((image: HTMLImageElement) => ({
      src: image.getAttribute('src'),
      currentSrc: image.currentSrc,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      frame: {
        width: image.getBoundingClientRect().width,
        height: image.getBoundingClientRect().height,
      },
    }));
    expect(imageDetails.naturalWidth, JSON.stringify(imageDetails)).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await contentEditor.fill(
      `<h2>Final publish snapshot</h2><p>Last-minute copy.</p><img src="asset:${imageAssetId}" alt="Diagram">`,
    );
    await page.getByRole('button', { name: 'Publish as EPUB 3' }).click();
    const publishDialog = page.getByRole('dialog', { name: 'Publish EPUB 3 publication' });
    await expect(publishDialog).toBeVisible();
    await publishDialog.getByRole('button', { name: 'Confirm and publish' }).click();

    await expect(page.getByText('Publication published')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Revision #1/)).toBeVisible();
    await expect(page.getByText(/SHA-256:/)).toBeVisible();

    const published = mock.getPublishedPublication();
    expect(published?.chapters.map((chapter) => chapter.title)).toEqual([
      'Prologue: The Awakening',
      'Chapter 1',
    ]);
    expect(published?.chapters[0]?.contentHtml).toContain('Final publish snapshot');
    expect(published?.chapters[0]?.contentHtml).toContain(`asset:${imageAssetId}`);
    expect(published?.creators).toEqual(['Ada Lovelace', 'Augusta King']);
    expect(published?.language).toBe('en-GB');
    expect(published?.identifier).toBe('urn:uuid:authoring-e2e-final');
    expect(published?.coverImageAssetId).toBe(imageAssetId);
    expect(published?.stylesheetAssetIds).toContain(mock.getAssetId('book.css'));
  });
});
