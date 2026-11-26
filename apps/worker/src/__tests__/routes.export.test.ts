import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  makeEnv,
  makeAuthContext,
  makePassThroughContext,
  mockQueryAll,
  mockQueryFirst,
  mockRequireAuth,
  parseBody,
} from './fixtures';
import { app } from '../app';
import { assertBookAccess } from '../lib/tenant-isolation';
import { defined } from './helpers';
import { EpubAnnotationExportError } from '@do-epub-studio/reader-core/packager';
import {
  EpubAnnotationExportFailure,
  createValidatedAnnotationEpub,
} from '../lib/epub-annotation-export';

vi.mock('../lib/tenant-isolation', () => ({ parseLocatorRow: vi.fn(), assertBookAccess: vi.fn() }));

vi.mock('../lib/epub-annotation-export', () => ({
  EpubAnnotationExportFailure: class EpubAnnotationExportFailure extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = 'EpubAnnotationExportFailure';
    }
  },
  createValidatedAnnotationEpub: vi.fn(),
}));
const mockCreateValidatedAnnotationEpub = vi.mocked(createValidatedAnnotationEpub);
const mockAssertBookAccess = vi.mocked(assertBookAccess);

describe('Export Routes', () => {
  const env = makeEnv();

  /** Queue the three concurrent export queries (highlights, comments, bookmarks) as resolved once. */
  function mockExportRows(
    highlights: unknown[] = [],
    comments: unknown[] = [],
    bookmarks: unknown[] = [],
  ) {
    mockQueryAll.mockResolvedValueOnce(highlights);
    mockQueryAll.mockResolvedValueOnce(comments);
    mockQueryAll.mockResolvedValueOnce(bookmarks);
  }

  /** Stub the book-title lookup the export route performs after the row queries. */
  function mockBookTitle(title: string) {
    mockQueryFirst.mockResolvedValueOnce({ title });
  }

  /** Build a highlight row fixture with per-test overrides. */
  function makeHighlightData(overrides: Record<string, unknown> = {}) {
    return {
      id: 'h1',
      selected_text: 'Default',
      color: 'yellow',
      note: null,
      chapter_ref: 'ch1',
      cfi_range: null,
      created_at: '2026-07-18',
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBookAccess.mockResolvedValue(null);
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await app.fetch(
      new Request('http://localhost/api/books/b1/export'),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(401);
  });

  it('returns markdown export with highlights', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExportRows([makeHighlightData({ selected_text: 'Important', note: 'My note' })]);
    mockBookTitle('Test Book');
    const res = await app.fetch(
      new Request('http://localhost/api/books/b1/export?format=markdown', {
        headers: { Authorization: 'Bearer valid' },
      }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data.format).toBe('markdown');
    expect(body.data.content).toContain('Important');
  });

  it('escapes special characters including single quotes in HTML export', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExportRows([
      makeHighlightData({
        selected_text: `<script>alert('XSS')</script>`,
        note: `User's "special" & <dangerous> note`,
        chapter_ref: `Ch 1 & '2'`,
      }),
    ]);
    mockBookTitle(`O'Reilly <Book> & "More"`);

    const res = await app.fetch(
      new Request('http://localhost/api/books/b1/export?format=html', {
        headers: { Authorization: 'Bearer valid' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await parseBody(res);
    const content = body.data.content as string;

    expect(content).not.toContain('<script>');
    expect(content).toContain('&lt;script&gt;');
    expect(content).toContain('O&#39;Reilly');
    expect(content).toContain('User&#39;s');
    expect(content).toContain('&quot;special&quot;');
  });

  it('escapes markdown formatting characters in Markdown export', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExportRows([
      makeHighlightData({
        selected_text: '*Bold & [Link](http://evil.com)* # Header',
        note: 'Note with `code` and > quote',
        chapter_ref: 'Ch #1 *test*',
      }),
    ]);
    mockBookTitle('# Title with [link]');

    const res = await app.fetch(
      new Request('http://localhost/api/books/b1/export?format=markdown', {
        headers: { Authorization: 'Bearer valid' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await parseBody(res);
    const content = body.data.content as string;

    expect(content).toContain('\\# Title');
    expect(content).toContain('\\[link\\]');
    expect(content).toContain('\\*Bold');
  });

  it('returns html export with proper structure', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExportRows();
    mockBookTitle('Test');
    const res = await app.fetch(
      new Request('http://localhost/api/books/b1/export?format=html', {
        headers: { Authorization: 'Bearer valid' },
      }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data.format).toBe('html');
    expect(typeof body.data.content).toBe('string');
    expect((body.data.content as string).length).toBeGreaterThan(100);
  });

  it('threads comment replies under their top-level parent in the export', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    // Deliberately interleaved source order: a later top-level parent, then an
    // earlier one, with replies for each. threadComments must preserve
    // top-level source order and keep each parent's replies immediately
    // beneath it.
    mockExportRows(
      [],
      [
        {
          id: 'c2',
          body: 'Parent 2',
          selected_text: null,
          chapter_ref: null,
          cfi_range: null,
          status: 'active',
          parent_comment_id: null,
          created_at: '2026-07-18',
        },
        {
          id: 'c1',
          body: 'Parent 1',
          selected_text: null,
          chapter_ref: null,
          cfi_range: null,
          status: 'active',
          parent_comment_id: null,
          created_at: '2026-07-18',
        },
        {
          id: 'r1',
          body: 'Reply to 1',
          selected_text: null,
          chapter_ref: null,
          cfi_range: null,
          status: 'active',
          parent_comment_id: 'c1',
          created_at: '2026-07-18',
        },
        {
          id: 'r2',
          body: 'Reply to 2',
          selected_text: null,
          chapter_ref: null,
          cfi_range: null,
          status: 'active',
          parent_comment_id: 'c2',
          created_at: '2026-07-18',
        },
        {
          id: 'r22',
          body: 'Second reply to 2',
          selected_text: null,
          chapter_ref: null,
          cfi_range: null,
          status: 'active',
          parent_comment_id: 'c2',
          created_at: '2026-07-18',
        },
      ],
    );
    mockBookTitle('Threads');

    const res = await app.fetch(
      new Request('http://localhost/api/books/b1/export?format=markdown', {
        headers: { Authorization: 'Bearer valid' },
      }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(200);
    const content = (await parseBody(res)).data.content as string;

    // Top-level parents render in source order (c2 before c1).
    expect(content.indexOf('Parent 2')).toBeLessThan(content.indexOf('Parent 1'));
    // Each parent's replies render immediately after it, before the next parent.
    expect(content.indexOf('Reply to 2')).toBeGreaterThan(content.indexOf('Parent 2'));
    expect(content.indexOf('Second reply to 2')).toBeGreaterThan(content.indexOf('Reply to 2'));
    expect(content.indexOf('Reply to 2')).toBeLessThan(content.indexOf('Parent 1'));
    expect(content.indexOf('Reply to 1')).toBeGreaterThan(content.indexOf('Parent 1'));
  });

  it('runs the three export queries concurrently', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockBookTitle('Test Book');

    // Deferred promises let us observe that all three queries are started
    // before any result is consumed — the observable signal of Promise.all.
    const resolvers: Array<(v: unknown[]) => void> = [];
    mockQueryAll.mockImplementation(
      () =>
        new Promise<unknown[]>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const reqPromise = app.fetch(
      new Request('http://localhost/api/books/b1/export?format=markdown', {
        headers: { Authorization: 'Bearer valid' },
      }),
      env,
      makePassThroughContext(),
    );

    // All three queryAll calls must be issued before any response is produced.
    await vi.waitFor(() => expect(mockQueryAll).toHaveBeenCalledTimes(3));

    defined(resolvers[0])([makeHighlightData({ selected_text: 'Concurrent' })]);
    defined(resolvers[1])([]);
    defined(resolvers[2])([]);

    const res = await reqPromise;
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    const content = body.data.content as string;
    expect(content).toContain('Concurrent');
  });

  it('returns 400 for invalid format', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    const res = await app.fetch(
      new Request('http://localhost/api/books/b1/export?format=invalid', {
        headers: { Authorization: 'Bearer valid' },
      }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(400);
  });
});
describe('EPUB Export Routes', () => {
  const env = makeEnv();
  const fetchMock = vi.fn();

  const EPUB_BYTES = new TextEncoder().encode('fake-generated-epub-bytes');

  function enableRunner(): void {
    env.EPUBCHECK_RUNNER_URL = 'https://runner.example';
    env.EPUBCHECK_RUNNER_TOKEN = 'runner-token';
  }

  function disableRunner(): void {
    delete env.EPUBCHECK_RUNNER_URL;
    delete env.EPUBCHECK_RUNNER_TOKEN;
  }

  function mockBookTitle(title: string): void {
    mockQueryFirst.mockResolvedValueOnce({ title });
  }

  function epubRequest(): Request {
    return new Request('http://localhost/api/books/b1/export?format=epub', {
      headers: { Authorization: 'Bearer valid' },
    });
  }

  function mockHappyPath(): void {
    mockBookTitle('My Book');
    mockCreateValidatedAnnotationEpub.mockResolvedValue(EPUB_BYTES);
  }

  function rejectExport(failure: Error): void {
    mockCreateValidatedAnnotationEpub.mockRejectedValue(failure);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockCreateValidatedAnnotationEpub.mockReset();
    fetchMock.mockReset();
    mockAssertBookAccess.mockResolvedValue(null);
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    enableRunner();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the validated EPUB attachment with a safe filename', async () => {
    mockHappyPath();

    const res = await app.fetch(epubRequest(), env, makePassThroughContext());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/epub+zip');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-length')).toBe(String(EPUB_BYTES.byteLength));
    const disposition = res.headers.get('content-disposition') ?? '';
    expect(disposition).toContain('attachment');
    expect(disposition).toContain('filename="My Book-annotations.epub"');
    expect(disposition).toContain("filename*=UTF-8''My%20Book-annotations.epub");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(EPUB_BYTES);
  });

  it('bounds filename scanning when a title consists of stripped separators', async () => {
    mockBookTitle(`${'/'.repeat(256)}Safe`);
    mockCreateValidatedAnnotationEpub.mockResolvedValue(EPUB_BYTES);

    const res = await app.fetch(epubRequest(), env, makePassThroughContext());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('filename="Safe-annotations.epub"');
  });

  it('uses an ASCII fallback stem and UTF-8 filename* for non-ASCII titles', async () => {
    mockBookTitle('Букварик');
    mockCreateValidatedAnnotationEpub.mockResolvedValue(EPUB_BYTES);

    const res = await app.fetch(epubRequest(), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const disposition = res.headers.get('content-disposition') ?? '';
    expect(disposition).toContain('filename="book-annotations.epub"');
    expect(disposition).toContain(
      "filename*=UTF-8''%D0%91%D1%83%D0%BA%D0%B2%D0%B0%D1%80%D0%B8%D0%BA-annotations.epub",
    );
  });

  it('sanitizes adversarial titles and RFC5987-escapes filename*', async () => {
    mockBookTitle("O'Brien (Vol. 1)* \u0000\u001F");
    mockCreateValidatedAnnotationEpub.mockResolvedValue(EPUB_BYTES);

    const res = await app.fetch(epubRequest(), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const disposition = res.headers.get('content-disposition') ?? '';
    expect(disposition).toContain('filename="O\'Brien (Vol. 1)-annotations.epub"');
    expect(disposition).toContain("filename*=UTF-8''O%27Brien%20%28Vol.%201%29-annotations.epub");
    for (const char of disposition) {
      expect(char.charCodeAt(0)).toBeGreaterThanOrEqual(0x20);
    }
    expect(disposition).not.toContain('\\');
    expect(disposition).not.toContain('\u0000');
    expect(disposition).not.toContain('\u001F');
  });

  it('keeps markdown exports independent of R2 and the validator', async () => {
    const getSpy = vi.spyOn(env.BOOKS_BUCKET, 'get');
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'h1',
        selected_text: 'Legacy',
        color: 'yellow',
        note: null,
        chapter_ref: null,
        cfi_range: null,
        created_at: '2026-07-18',
      },
    ]);
    mockQueryAll.mockResolvedValueOnce([]);
    mockQueryAll.mockResolvedValueOnce([]);
    mockQueryFirst.mockResolvedValueOnce({ title: 'Legacy Book' });

    const res = await app.fetch(
      new Request('http://localhost/api/books/b1/export?format=markdown', {
        headers: { Authorization: 'Bearer valid' },
      }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data.format).toBe('markdown');
    expect(body.data.content as string).toContain('Legacy');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await app.fetch(epubRequest(), env, makePassThroughContext());
    expect(res.status).toBe(401);
  });

  it('denies the export without book access', async () => {
    mockAssertBookAccess.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false }), { status: 403 }),
    });
    const res = await app.fetch(epubRequest(), env, makePassThroughContext());
    expect(res.status).toBe(403);
    expect(mockCreateValidatedAnnotationEpub).not.toHaveBeenCalled();
  });

  it('returns 404 NOT_FOUND when the book has no revision', async () => {
    rejectExport(new EpubAnnotationExportFailure('SOURCE_NOT_FOUND', 'no revision'));
    const res = await app.fetch(epubRequest(), env, makePassThroughContext());
    expect(res.status).toBe(404);
    const body = await parseBody(res);
    expect(body.error?.code).toBe('NOT_FOUND');
  });

  it('returns 409 for a local-only source', async () => {
    rejectExport(new EpubAnnotationExportFailure('SOURCE_UNAVAILABLE', 'local-only'));
    const res = await app.fetch(epubRequest(), env, makePassThroughContext());
    expect(res.status).toBe(409);
    const body = await parseBody(res);
    expect(body.error?.code).toBe('EXPORT_SOURCE_UNAVAILABLE');
  });

  it('returns 409 when the R2 object is missing', async () => {
    rejectExport(new EpubAnnotationExportFailure('SOURCE_UNAVAILABLE', 'missing object'));
    const res = await app.fetch(epubRequest(), env, makePassThroughContext());
    expect(res.status).toBe(409);
    const body = await parseBody(res);
    expect(body.error?.code).toBe('EXPORT_SOURCE_UNAVAILABLE');
  });

  it('returns 409 when R2 size does not match D1', async () => {
    rejectExport(new EpubAnnotationExportFailure('SOURCE_UNAVAILABLE', 'size mismatch'));
    const res = await app.fetch(epubRequest(), env, makePassThroughContext());
    expect(res.status).toBe(409);
    const body = await parseBody(res);
    expect(body.error?.code).toBe('EXPORT_SOURCE_UNAVAILABLE');
  });

  it.each([
    ['SOURCE_TOO_LARGE', 'EXPORT_SOURCE_TOO_LARGE', 413],
    ['ANNOTATIONS_TOO_LARGE', 'EXPORT_ANNOTATIONS_TOO_LARGE', 413],
    ['OUTPUT_TOO_LARGE', 'EXPORT_OUTPUT_TOO_LARGE', 413],
    ['SOURCE_INVALID', 'EXPORT_SOURCE_INVALID', 422],
    ['SOURCE_UNSAFE', 'EXPORT_SOURCE_INVALID', 422],
    ['SIGNATURES_UNSUPPORTED', 'EXPORT_UNSUPPORTED_SIGNATURE', 422],
    ['ENCRYPTION_UNSUPPORTED', 'EXPORT_UNSUPPORTED_ENCRYPTION', 422],
  ] as const)('maps EpubAnnotationExportError %s to %s', async (code, expectedCode, status) => {
    rejectExport(new EpubAnnotationExportError(code, 'boom'));
    const res = await app.fetch(epubRequest(), env, makePassThroughContext());
    expect(res.status).toBe(status);
    const body = await parseBody(res);
    expect(body.error?.code).toBe(expectedCode);
  });

  it('returns 503 when the runner is not configured', async () => {
    disableRunner();
    rejectExport(new EpubAnnotationExportFailure('EPUBCHECK_UNAVAILABLE', 'not configured'));
    const res = await app.fetch(epubRequest(), env, makePassThroughContext());
    expect(res.status).toBe(503);
    const body = await parseBody(res);
    expect(body.error?.code).toBe('EXPORT_VALIDATION_UNAVAILABLE');
  });

  it('returns 503 on runner network failure', async () => {
    rejectExport(new EpubAnnotationExportFailure('EPUBCHECK_UNAVAILABLE', 'network'));
    const res = await app.fetch(epubRequest(), env, makePassThroughContext());
    expect(res.status).toBe(503);
    const body = await parseBody(res);
    expect(body.error?.code).toBe('EXPORT_VALIDATION_UNAVAILABLE');
  });

  it('returns 504 when the runner times out', async () => {
    rejectExport(new EpubAnnotationExportFailure('EPUBCHECK_TIMEOUT', 'timeout'));
    const res = await app.fetch(epubRequest(), env, makePassThroughContext());
    expect(res.status).toBe(504);
    const body = await parseBody(res);
    expect(body.error?.code).toBe('EXPORT_VALIDATION_TIMEOUT');
  });

  it.each([
    ['EPUBCHECK_INVALID_RESPONSE', 'EXPORT_VALIDATION_INVALID', 502],
    ['EPUBCHECK_INTEGRITY_ERROR', 'EXPORT_VALIDATION_MISMATCH', 502],
    ['EPUBCHECK_SAFETY_REJECTED', 'EXPORT_OUTPUT_UNSAFE', 422],
    ['EPUBCHECK_CONFORMANCE_FAILED', 'EXPORT_VALIDATION_FAILED', 422],
  ] as const)('maps EpubAnnotationExportFailure %s to %s', async (code, expectedCode, status) => {
    rejectExport(new EpubAnnotationExportFailure(code, 'boom'));
    const res = await app.fetch(epubRequest(), env, makePassThroughContext());
    expect(res.status).toBe(status);
    const body = await parseBody(res);
    expect(body.error?.code).toBe(expectedCode);
  });
});
