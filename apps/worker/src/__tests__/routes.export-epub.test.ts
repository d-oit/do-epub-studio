import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { buildZip, EPUB_ANNOTATION_EXPORT_LIMITS } from '@do-epub-studio/reader-core/packager';
import type { Env } from '../lib/env';
import {
  makeAuthContext,
  makeEnv,
  makePassThroughContext,
  mockQueryAll,
  mockQueryFirst,
  mockRequireAuth,
  parseBody,
} from './fixtures';
import { app } from '../app';
import { assertBookAccess } from '../lib/tenant-isolation';

vi.mock('../lib/tenant-isolation', () => ({ parseLocatorRow: vi.fn(), assertBookAccess: vi.fn() }));
const mockAssertBookAccess = assertBookAccess as ReturnType<typeof vi.fn>;

const encoder = new TextEncoder();
const chapterBytes = encoder.encode(
  '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter</title></head><body><h1>Chapter</h1><p>Original chapter</p></body></html>',
);
const imageBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
);

async function sourceEpub(): Promise<Uint8Array<ArrayBuffer>> {
  return buildZip([
    { name: 'mimetype', data: encoder.encode('application/epub+zip'), store: true },
    {
      name: 'META-INF/container.xml',
      data: encoder.encode(
        '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
      ),
    },
    {
      name: 'OEBPS/content.opf',
      data: encoder.encode(
        '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0" unique-identifier="uid"><metadata><dc:identifier id="uid">urn:test:annotations</dc:identifier><dc:title>Original title</dc:title><dc:creator>Original author</dc:creator><dc:language>en</dc:language><meta property="dcterms:modified">2024-01-01T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="image" href="images/image.png" media-type="image/png"/></manifest><spine><itemref idref="chapter"/></spine></package>',
      ),
    },
    {
      name: 'OEBPS/nav.xhtml',
      data: encoder.encode(
        '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="chapter.xhtml">Chapter</a></li></ol></nav></body></html>',
      ),
    },
    { name: 'OEBPS/chapter.xhtml', data: chapterBytes },
    { name: 'OEBPS/images/image.png', data: imageBytes },
  ]);
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function runnerPayload(sha256: string, overrides: Record<string, unknown> = {}) {
  return {
    validatorVersion: '5.4.0',
    sha256,
    epubVersion: '3.0',
    findings: [],
    accessibility: {
      metadata: [],
      advisories: [],
      manualReviewRequired: true,
      certification: 'not-certified',
    },
    safetyStatus: 'accepted',
    conformanceStatus: 'completed',
    ...overrides,
  };
}

function mockRunner(
  makeResponse: (bytes: Uint8Array<ArrayBuffer>) => Response | Promise<Response>,
) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const bytes = new Uint8Array(await new Response(init?.body).arrayBuffer());
    return await makeResponse(bytes);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mockEpubDatabase(
  env: Env,
  source: Uint8Array<ArrayBuffer>,
  rows: {
    highlights?: unknown[];
    comments?: unknown[];
    bookmarks?: unknown[];
    highlightCount?: number;
    highlightTextBytes?: number;
    commentTextBytes?: number;
    bookmarkTextBytes?: number;
  } = {},
) {
  const highlights = rows.highlights ?? [];
  const comments = rows.comments ?? [];
  const bookmarks = rows.bookmarks ?? [];
  mockQueryFirst
    .mockResolvedValueOnce({
      id: 'revision-1',
      storage_key: 'books/book-1/revision-1.epub',
      file_size_bytes: source.byteLength,
    })
    .mockResolvedValueOnce({
      row_count: rows.highlightCount ?? highlights.length,
      text_bytes: rows.highlightTextBytes ?? 0,
    })
    .mockResolvedValueOnce({ row_count: comments.length, text_bytes: rows.commentTextBytes ?? 0 })
    .mockResolvedValueOnce({
      row_count: bookmarks.length,
      text_bytes: rows.bookmarkTextBytes ?? 0,
    });
  mockQueryAll
    .mockResolvedValueOnce(highlights)
    .mockResolvedValueOnce(comments)
    .mockResolvedValueOnce(bookmarks);

  const bucket = env.BOOKS_BUCKET as unknown as {
    get: (key: string) => Promise<{ size: number; arrayBuffer: () => Promise<ArrayBuffer> } | null>;
  };
  const getObject = vi.fn().mockResolvedValue({
    size: source.byteLength,
    arrayBuffer: () => Promise.resolve(source.buffer),
  });
  bucket.get = getObject;
  return getObject;
}

async function exportRequest(env: Env): Promise<Response> {
  return await app.fetch(
    new Request('http://localhost/api/books/book-1/export?format=epub', {
      headers: { Authorization: 'Bearer valid' },
    }),
    env,
    makePassThroughContext(),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(makeAuthContext());
  mockAssertBookAccess.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/books/:id/export?format=epub', () => {
  it('returns a validated navigable EPUB with all annotation types and original resources', async () => {
    const source = await sourceEpub();
    const env = makeEnv();
    env.EPUBCHECK_RUNNER_URL = 'https://runner.example/custom/path?untrusted=1';
    env.EPUBCHECK_RUNNER_TOKEN = 'runner-secret';
    const getObject = mockEpubDatabase(env, source, {
      highlights: [
        {
          id: 'highlight-1',
          selected_text: 'Highlighted passage',
          note: 'Safe note',
          chapter_ref: 'chapter.xhtml',
          cfi_range: 'epubcfi(/6/2[chapter]!/4/2:0)',
          revision_id: 'revision-1',
          original_cfi: null,
          original_chapter_ref: null,
          original_selected_text: null,
          anchor_status: 'anchored',
        },
      ],
      comments: [
        {
          id: 'comment-1',
          body: '<script>alert(1)</script>',
          selected_text: 'Comment passage',
          chapter_ref: 'chapter.xhtml',
          cfi_range: 'epubcfi(/6/2[chapter]!/4/2:0)',
          parent_comment_id: null,
          revision_id: 'revision-1',
          original_cfi: null,
          original_chapter_ref: null,
          original_selected_text: null,
          anchor_status: 'anchored',
        },
      ],
      bookmarks: [
        {
          id: 'bookmark-1',
          label: 'Reading position',
          locator_json: JSON.stringify({
            cfi: 'epubcfi(/6/2[chapter]!/4/2:0)',
            chapterRef: 'chapter.xhtml',
            selectedText: 'Bookmark passage',
          }),
        },
      ],
    });
    const fetchMock = mockRunner(
      async (bytes) =>
        new Response(JSON.stringify(runnerPayload(await sha256Hex(bytes))), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const response = await exportRequest(env);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/epub+zip');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="annotations.epub"',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(Number(response.headers.get('content-length'))).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL('https://runner.example/validate'));
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>).authorization).toBe(
      'Bearer runner-secret',
    );
    expect(getObject).toHaveBeenCalledWith('books/book-1/revision-1.epub');
    expect(
      mockQueryAll.mock.calls.every(
        (call) => call[2]?.[0] === 'book-1' && call[2]?.[1] === 'user@example.com',
      ),
    ).toBe(true);

    const output = new Uint8Array(await response.arrayBuffer());
    const zip = await JSZip.loadAsync(output);
    const packageXml = await zip.file('OEBPS/content.opf')?.async('string');
    const nav = await zip.file('OEBPS/nav.xhtml')?.async('string');
    const appendix = (await zip.file('OEBPS/annotations.xhtml')?.async('string')) ?? '';
    const chapter = await zip.file('OEBPS/chapter.xhtml')?.async('uint8array');
    const image = await zip.file('OEBPS/images/image.png')?.async('uint8array');

    expect(packageXml).toContain('<dc:identifier id="uid">urn:test:annotations</dc:identifier>');
    expect(packageXml).toContain('<dc:title>Original title</dc:title>');
    expect(packageXml).toContain('<dc:creator>Original author</dc:creator>');
    expect(packageXml).toContain('annotations.xhtml');
    expect(nav).toContain('Annotations');
    expect(appendix).toContain('Highlight 1');
    expect(appendix).toContain('Comment 2');
    expect(appendix).toContain('Bookmark 3');
    expect(appendix.split('>Open source location</a>').length - 1).toBe(3);
    expect(appendix).toContain('href="content.opf#epubcfi');
    expect(appendix).toContain('Highlighted passage');
    expect(appendix).toContain('Reading position');
    expect(appendix).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(appendix).not.toContain('<script>');
    expect(appendix).not.toMatch(/href=["']https?:/i);
    expect(Array.from(chapter ?? [])).toEqual(Array.from(chapterBytes));
    expect(Array.from(image ?? [])).toEqual(Array.from(imageBytes));
  });

  it('keeps the export route behind authentication and private-book access checks', async () => {
    const env = makeEnv();
    mockRequireAuth.mockResolvedValue(null);
    expect((await exportRequest(env)).status).toBe(401);
    expect(mockQueryFirst).not.toHaveBeenCalled();

    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockAssertBookAccess.mockResolvedValue({ response: new Response('denied', { status: 403 }) });
    expect((await exportRequest(env)).status).toBe(403);
    expect(mockQueryFirst).not.toHaveBeenCalled();
  });

  it('rejects source and annotation limits before fetching or buffering the EPUB', async () => {
    const env = makeEnv();
    const source = await sourceEpub();
    const getObject = mockEpubDatabase(env, source, { highlightCount: 501 });
    expect((await exportRequest(env)).status).toBe(413);
    expect(getObject).not.toHaveBeenCalled();

    const oversizedEnv = makeEnv();
    mockQueryFirst.mockResolvedValueOnce({
      id: 'revision-2',
      storage_key: 'oversized.epub',
      file_size_bytes: 8 * 1024 * 1024 + 1,
    });
    expect((await exportRequest(oversizedEnv)).status).toBe(413);
    expect(mockQueryFirst).toHaveBeenCalledTimes(5);
  });

  it('rejects aggregate annotation text before fetching the source EPUB', async () => {
    const env = makeEnv();
    const source = await sourceEpub();
    const getObject = mockEpubDatabase(env, source, {
      highlightTextBytes: EPUB_ANNOTATION_EXPORT_LIMITS.maxAnnotationTextBytes + 1,
    });

    const response = await exportRequest(env);

    expect(response.status).toBe(413);
    expect(getObject).not.toHaveBeenCalled();
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('fails closed when EPUBCheck is not configured', async () => {
    const env = makeEnv();
    const source = await sourceEpub();
    mockEpubDatabase(env, source);

    const response = await exportRequest(env);

    expect(response.status).toBe(503);
    expect((await parseBody(response)).error?.code).toBe('EPUBCHECK_UNAVAILABLE');
  });

  it.each([
    {
      name: 'runner HTTP failure',
      status: 503,
      expectedStatus: 503,
      body: () => 'unavailable',
    },
    {
      name: 'archive safety rejection',
      status: 422,
      expectedStatus: 422,
      body: () => JSON.stringify({ safetyStatus: 'rejected' }),
    },
    {
      name: 'malformed runner result',
      status: 200,
      expectedStatus: 502,
      body: () => JSON.stringify({ safetyStatus: 'accepted' }),
    },
    {
      name: 'EPUBCheck error finding',
      status: 200,
      expectedStatus: 422,
      body: (sha256: string) =>
        JSON.stringify(
          runnerPayload(sha256, {
            findings: [
              {
                severity: 'error',
                code: 'RSC-005',
                location: null,
                path: null,
                message: 'Invalid XHTML',
              },
            ],
          }),
        ),
    },
    {
      name: 'runner conformance failure',
      status: 200,
      expectedStatus: 422,
      body: (sha256: string) =>
        JSON.stringify(runnerPayload(sha256, { conformanceStatus: 'failed' })),
    },
    {
      name: 'runner SHA-256 mismatch',
      status: 200,
      expectedStatus: 502,
      body: () => JSON.stringify(runnerPayload('0'.repeat(64))),
    },
    {
      name: 'runner response size limit',
      status: 200,
      expectedStatus: 502,
      body: () => 'x'.repeat(300_001),
    },
  ])('returns an error for $name', async ({ status, expectedStatus, body }) => {
    const source = await sourceEpub();
    const env = makeEnv();
    env.EPUBCHECK_RUNNER_URL = 'https://runner.example';
    env.EPUBCHECK_RUNNER_TOKEN = 'runner-secret';
    mockEpubDatabase(env, source);
    mockRunner(async (bytes) => {
      const content = body(await sha256Hex(bytes));
      return new Response(content, { status, headers: { 'content-type': 'application/json' } });
    });

    const response = await exportRequest(env);

    expect(response.status).toBe(expectedStatus);
    expect((await parseBody(response)).ok).toBe(false);
  });
});
