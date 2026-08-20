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
    token: 'admin-session-token',
    user: { id: 'admin-1', email: ADMIN_USER.email, role: 'admin' },
  },
};

export const DEMO_READER = {
  email: 'demo.reader@example.local',
  password: process.env.DEMO_READER_PASSWORD || 'demo-reader-password',
  bookSlug: 'demo',
};

export const DEMO_ADMIN = {
  email: 'demo.admin@example.local',
  password: process.env.DEMO_ADMIN_PASSWORD || 'demo-admin-password',
};

export const DEMO_READER_RESPONSE = {
  ok: true,
  data: {
    sessionToken: 'demo-reader-session-token',
    book: {
      id: 'book-demo',
      slug: 'demo',
      title: 'Demo Book',
      authorName: 'Demo Author',
      visibility: 'public',
      coverImageUrl: null,
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

export const DEMO_ADMIN_RESPONSE = {
  ok: true,
  data: {
    token: 'demo-admin-session-token',
    user: { id: 'demo-admin-1', email: 'demo.admin@example.local', role: 'admin' },
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
  demoLoginResponse?: typeof DEMO_READER_RESPONSE;
  includeBookmarks?: boolean;
  includeLogout?: boolean;
  includeInsights?: boolean;
}

export async function mockReaderApi(page: Page, opts: MockRouteOptions = {}) {
  const bookSlug = opts.bookSlug ?? TEST_USER.bookSlug;
  const hasCustomEpubUrl = opts.epubUrl !== undefined;
  const epubUrl = opts.epubUrl ?? `https://example.com/${bookSlug}.epub`;
  const loginResp = opts.loginResponse ?? LOGIN_RESPONSE;

  await page.route('**/api/access/request', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(loginResp) });
  });

  // ADR-244: demo reader session entry point. Same DTO shape as /api/access/request.
  if (opts.demoLoginResponse) {
    await page.route('**/api/demo/reader-login', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.demoLoginResponse) });
    });
  }

  await page.route('**/api/books/*/file-url', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { url: epubUrl } }) });
  });

  // Always intercept the DEFAULT EPUB URL. The default mock URL
  // (https://example.com/...) is a real cross-origin fetch that is not served
  // with CORS headers reliably; when the fetch fails it surfaces as an uncaught
  // page error, which suppressWorkboxErrors rethrows — failing reader tests on
  // the nightly scheduled E2E lane (issue #957). Tests that pass an explicit
  // epubUrl WITHOUT epubBuffer opt out here and exercise real-network behavior.
  if (opts.epubBuffer || !hasCustomEpubUrl) {
    const epubPattern = epubUrl.startsWith('http') ? `**/${bookSlug}.epub` : `**${epubUrl}`;
    await page.route(epubPattern, async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/epub+zip', body: opts.epubBuffer ?? MOCK_EPUB });
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

/**
 * ADR-244: mock the demo admin session endpoint. Caller must also call
 * `mockAdminApi` (or this returns after wiring just the demo route) so the
 * `/admin/books` destination resolves.
 */
export async function mockDemoAdminApi(page: Page) {
  await page.route('**/api/demo/admin-login', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DEMO_ADMIN_RESPONSE) });
  });
}

export async function mockAdminApi(page: Page, opts: { adminLoginResponse?: { ok: true; data: { token: string; user: { id: string; email: string; role: string } } } } = {}) {
  await page.route('**/api/admin/login', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.adminLoginResponse ?? ADMIN_LOGIN_RESPONSE) });
  });

  await mockDemoAdminApi(page);

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

/**
 * Click a toolbar button, handling mobile overflow menu automatically.
 * On mobile viewports, toolbar buttons are hidden behind a "More options"
 * overflow menu due to container query layout (ReaderToolbar.tsx).
 */
export async function clickToolbarButton(page: Page, buttonName: string | RegExp) {
  // Reader toolbar actions are mounted lazily after navigation. Wait for the
  // toolbar itself before resolving direct versus overflow actions so WebKit
  // does not race the first render and report a false missing-button failure.
  await page.locator('[data-container-name="reader-toolbar"]').waitFor({
    state: 'visible',
    timeout: 20000,
  });

  // First try direct visibility
  const directBtn = page.getByRole('button', { name: buttonName });
  for (const candidate of await directBtn.all()) {
    if (await candidate.isVisible({ timeout: 2000 }).catch(() => false)) {
      await candidate.dispatchEvent('click');
      return;
    }
  }

  // Some browser engines keep the desktop action in the DOM but report it as
  // hidden while container-query styles settle. Dispatch the action directly
  // before falling back to the overflow menu; this preserves the intended
  // action without relying on a browser-specific visibility calculation.
  if (await directBtn.count()) {
    await directBtn.first().dispatchEvent('click');
    return;
  }

  // If no direct action exists, it is behind the "More options" overflow menu
  // (container-query driven). Wait for the trigger to actually render: the
  // toolbar re-renders lazily and a short isVisible() check races it, which
  // previously fell through to a blind dispatchEvent on the hidden button and
  // timed out on the scheduled cross-browser lane (issue #994).
  const moreBtn = page.getByRole('button', { name: /More [Oo]ptions/i });
  await moreBtn.waitFor({ state: 'visible', timeout: 10000 });
  await moreBtn.dispatchEvent('click');
  // GOAP-224 B8: overflow entries are role="menuitem" (WAI-ARIA Menu Button
  // Pattern), not buttons — match either so the helper keeps working.
  const overflowMenu = page.locator('.cq-reader-toolbar-overflow');
  const overflowBtn = overflowMenu
    .getByRole('menuitem', { name: buttonName })
    .or(overflowMenu.getByRole('button', { name: buttonName }));
  await overflowBtn.waitFor({ state: 'visible', timeout: 5000 });
  await overflowBtn.dispatchEvent('click');
}

/**
 * Suppress non-fatal workbox SW registration PAGE ERRORs in preview mode.
 * These are `Cannot read properties of undefined (reading 'waiting')` errors
 * from the workbox bundle that appear as console errors but don't cause
 * test failures. Call this in test.beforeEach() or at the top of a test.
 */
export function suppressWorkboxErrors(page: Page) {
  page.on('pageerror', (error) => {
    const msg = error.message;
    if (msg.includes("reading 'waiting'")) return;
    // Environmental network noise in the E2E preview env (no Worker backend):
    // unmocked requests to localhost:8787 and cross-origin mock URLs surface as
    // page errors that are NOT app bugs. Treat network-level failures as noise
    // (they kept killing reader tests mid-axe-scan on the scheduled lane —
    // issue #957); rethrow anything that looks like an app-logic error.
    if (/Failed to load resource|ERR_CONNECTION_REFUSED|access control checks|Failed to fetch|AbortError|net::ERR_|Worker initialization failed/i.test(msg)) {
      return;
    }
    throw error;
  });
}

export async function loginAsReader(page: Page, bookSlug?: string) {
  const slug = bookSlug ?? TEST_USER.bookSlug;
  await page.goto(`/login?book=${slug}`);
  await page.getByLabel('Email Address').fill(TEST_USER.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/read/${slug}$`), { timeout: 15000 });
  // The reader is mounted once the toolbar renders. `networkidle` is
  // unreliable here: unmocked background fetches (e.g. bookmarks when the
  // test passes includeBookmarks: false) hit the absent Worker at
  // localhost:8787, and under parallel load the network never settles within
  // the timeout — the root cause of nightly scheduled E2E flakiness (#957).
  await expect(page.locator('[data-container-name="reader-toolbar"]')).toBeVisible({ timeout: 20000 });
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email Address').fill(ADMIN_USER.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(ADMIN_USER.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/books/, { timeout: 15000 });
  // Wait for the admin books page to mount instead of networkidle — background
  // fetches keep the network busy under parallel load (issue #957 flakiness).
  await expect(page.locator('main#main-content')).toBeVisible({ timeout: 20000 });
}
