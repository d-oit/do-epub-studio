import { expect, type Page, type Route } from '@playwright/test';
import { deflateSync } from 'zlib';

// ---------------------------------------------------------------------------
// CRC32 (standalone, no external deps)
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

// ---------------------------------------------------------------------------
// EPUB builder
// ---------------------------------------------------------------------------

export interface EpubChapter {
  id: string;
  href: string;
  title: string;
  body: string;
}

const DEFAULT_CHAPTERS: EpubChapter[] = [
  { id: 'c1', href: 'chapter1.xhtml', title: 'Chapter 1', body: '<p>CHAPTER ONE CONTENT for the smoke test reader.</p>' },
  { id: 'c2', href: 'chapter2.xhtml', title: 'Chapter 2', body: '<p>CHAPTER TWO CONTENT here, different from chapter one.</p>' },
];

export function createMinimalEpub(chapters: EpubChapter[] = DEFAULT_CHAPTERS, opts?: { title?: string; identifier?: string }): Buffer {
  const title = opts?.title ?? 'Test Book';
  const identifier = opts?.identifier ?? 'urn:uuid:test-book';

  const files: { name: string; data: Buffer; method: number }[] = [];

  files.push({ name: 'mimetype', data: Buffer.from('application/epub+zip'), method: 0 });

  files.push({
    name: 'META-INF/container.xml',
    data: Buffer.from('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
    method: 8,
  });

  const manifest = chapters.map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`).join('\n');
  const spine = chapters.map((c) => `<itemref idref="${c.id}"/>`).join('\n');

  files.push({
    name: 'content.opf',
    data: Buffer.from(`<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${identifier}</dc:identifier><dc:title>${title}</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${manifest}</manifest><spine>${spine}</spine></package>`),
    method: 8,
  });

  const tocEntries = chapters.map((c) => `<li><a href="${c.href}">${c.title}</a></li>`).join('\n');
  files.push({
    name: 'nav.xhtml',
    data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Navigation</title></head><body><nav epub:type="toc"><h1>Table of Contents</h1><ol>${tocEntries}</ol></nav></body></html>`),
    method: 8,
  });

  for (const ch of chapters) {
    files.push({
      name: ch.href,
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${ch.title}</title></head><body>${ch.body}</body></html>`),
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
// Pre-built EPUB buffers
// ---------------------------------------------------------------------------

export const MOCK_EPUB = createMinimalEpub([
  { id: 'c1', href: 'chapter1.xhtml', title: 'Chapter 1', body: '<p>Chapter 1 content.</p>' },
]);

// ---------------------------------------------------------------------------
// Default fixtures
// ---------------------------------------------------------------------------

export const TEST_USER = {
  email: 'reader@example.com',
  password: process.env.TEST_PASSWORD || 'test-password',
  bookSlug: 'my-test-book',
};

export const LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: process.env.TEST_SESSION_TOKEN || 'test-session-token-abc123',
    book: {
      id: 'book-1',
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

export const PROGRESS_RESPONSE = {
  ok: true,
  data: { locator: { cfi: 'epubcfi(/6/4)' }, progressPercent: 0.1 },
};

export const ADMIN_USER = {
  email: 'admin@example.com',
  password: process.env.TEST_PASSWORD || 'test-password',
};

export const ADMIN_LOGIN_RESPONSE = {
  ok: true,
  data: {
    sessionToken: 'admin-session-token',
    user: { id: 'admin-1', email: ADMIN_USER.email, role: 'admin' },
  },
};

// ---------------------------------------------------------------------------
// Route mock helpers
// ---------------------------------------------------------------------------

export interface MockRouteOptions {
  bookSlug?: string;
  epubUrl?: string;
  epubBuffer?: Buffer;
  loginResponse?: typeof LOGIN_RESPONSE;
  includeBookmarks?: boolean;
  includeLogout?: boolean;
  includeInsights?: boolean;
}

export async function mockReaderApi(page: Page, opts: MockRouteOptions = {}) {
  const bookSlug = opts.bookSlug ?? TEST_USER.bookSlug;
  const epubUrl = opts.epubUrl ?? `https://example.com/${bookSlug}.epub`;
  const loginResp = opts.loginResponse ?? LOGIN_RESPONSE;

  await page.route('**/api/access/request', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(loginResp) });
  });

  await page.route('**/api/books/*/file-url', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { url: epubUrl } }) });
  });

  if (opts.epubBuffer) {
    const epubPattern = epubUrl.startsWith('http') ? `**/${bookSlug}.epub` : `**${epubUrl}`;
    await page.route(epubPattern, async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/epub+zip', body: opts.epubBuffer });
    });
  }

  await page.route('**/api/books/*/progress', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROGRESS_RESPONSE) });
  });

  await page.route('**/api/books/*/highlights', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });

  await page.route('**/api/books/*/comments', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });

  if (opts.includeBookmarks !== false) {
    await page.route('**/api/books/*/bookmarks', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
    });
  }

  if (opts.includeInsights) {
    await page.route('**/api/books/*/insights', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: null }) });
    });
  }

  if (opts.includeLogout !== false) {
    await page.route('**/api/access/logout', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
    });
  }
}

export async function mockAdminApi(page: Page) {
  await page.route('**/api/admin/login', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ADMIN_LOGIN_RESPONSE) });
  });

  await page.route('**/api/admin/books**', async (route: Route) => {
    const books = [
      { id: 'book-1', slug: 'my-test-book', title: 'My Test Book', authorName: 'Test Author', visibility: 'private', createdAt: '2025-01-01T00:00:00Z' },
    ];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: books }) });
  });

  await page.route('**/api/admin/books/*/grants', async (route: Route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { id: 'grant-1', bookId: 'book-1', email: body?.email ?? 'user@example.com', status: 'active', expiresAt: null, createdAt: new Date().toISOString() },
        }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
    }
  });

  await page.route('**/api/admin/grants/*', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });

  await page.route('**/api/admin/grants/*/revoke', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {} }) });
  });

  await page.route('**/api/admin/audit**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
  });
}

// ---------------------------------------------------------------------------
// Login helpers
// ---------------------------------------------------------------------------

export async function loginAsReader(page: Page, bookSlug?: string) {
  const slug = bookSlug ?? TEST_USER.bookSlug;
  await page.goto(`/login?book=${slug}`);
  await page.getByLabel('Email Address').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/read/${slug}$`), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email Address').fill(ADMIN_USER.email);
  await page.getByLabel('Password').fill(ADMIN_USER.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/books/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}
