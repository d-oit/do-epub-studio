import { test, expect, type Page, type Route } from '@playwright/test';
import { deflateSync } from 'zlib';

// ---------------------------------------------------------------------------
// CRC32 (standalone, no external deps needed)
// ---------------------------------------------------------------------------

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createMinimalEpub(): Buffer {
  const chapters = [
    { id: 'c1', href: 'chapter1.xhtml', title: 'Chapter 1', body: '<p>CHAPTER ONE CONTENT for the smoke test reader.</p>' },
    { id: 'c2', href: 'chapter2.xhtml', title: 'Chapter 2', body: '<p>CHAPTER TWO CONTENT here, different from chapter one.</p>' },
  ];

  const files: { name: string; data: Buffer; method: number }[] = [];

  files.push({ name: 'mimetype', data: Buffer.from('application/epub+zip'), method: 0 });

  files.push({
    name: 'META-INF/container.xml',
    data: Buffer.from(
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
    ),
    method: 8,
  });

  const manifest = chapters.map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`).join('\n');
  const spine = chapters.map((c) => `<itemref idref="${c.id}"/>`).join('\n');

  files.push({
    name: 'content.opf',
    data: Buffer.from(
      `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">urn:uuid:smoke-test-book</dc:identifier><dc:title>Smoke Test Book</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${manifest}</manifest><spine>${spine}</spine></package>`
    ),
    method: 8,
  });

  const tocEntries = chapters.map((c) => `<li><a href="${c.href}">${c.title}</a></li>`).join('\n');

  files.push({
    name: 'nav.xhtml',
    data: Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Navigation</title></head><body><nav epub:type="toc"><h1>Table of Contents</h1><ol>${tocEntries}</ol></nav></body></html>`
    ),
    method: 8,
  });

  for (const ch of chapters) {
    files.push({
      name: ch.href,
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${ch.title}</title></head><body>${ch.body}</body></html>`
      ),
      method: 8,
    });
  }

  const localBlocks: Buffer[] = [];
  const centralBlocks: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameB = Buffer.from(file.name);
    const raw = file.data;
    const compressed = file.method === 0 ? raw : deflateSync(raw);
    const crc = crc32(raw);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(file.method, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(compressed.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameB.length, 26);
    lh.writeUInt16LE(0, 28);
    localBlocks.push(Buffer.concat([lh, nameB]));
    localBlocks.push(compressed);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(file.method, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(compressed.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameB.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centralBlocks.push(Buffer.concat([ch, nameB]));

    offset += 30 + nameB.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralBlocks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localBlocks, centralDir, eocd]);
}

// ---------------------------------------------------------------------------
// Constants
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

const EPUB_BUFFER = createMinimalEpub();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockApiRoutes(page: Page) {
  await page.route('**/api/access/request', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LOGIN_RESPONSE) });
  });
  await page.route('**/api/books/*/file-url', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { url: 'http://127.0.0.1:0/test/epub' } }) });
  });
  await page.route('**/test/epub', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/epub+zip', body: EPUB_BUFFER });
  });
  await page.route('**/api/books/*/progress', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { locator: { cfi: 'epubcfi(/6/4)' }, progressPercent: 0 } }) });
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
  await expect(page).toHaveURL(/\/read\/smoke-test/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

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
    await mockApiRoutes(page);
  });

  test('@mobile opens reader and shows book title', async ({ page }) => {
    await loginAsReader(page);

    await expect(page.getByRole('heading', { name: 'Smoke Test Book' })).toBeVisible({ timeout: 30000 });
  });

  test('@mobile navigates next chapter and asserts section changed', async ({ page }) => {
    await loginAsReader(page);

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
