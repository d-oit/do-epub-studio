import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryFirst,
  mockRequireAdminAuth,
} from './fixtures';
import { app } from '../app';
import { withByteCap, MaxBodySizeError, DEFAULT_MAX_BODY_BYTES } from '../lib/stream-body';

async function makeEpubBuffer(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  // Container and OPF XML are literal fixtures; "HTML in string" is a
  // false positive for these EPUB container documents.
  const containerXml = '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
  const opfXml = '<?xml version="1.0"?><package version="3.0" xmlns="http://idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Stream Test</dc:title></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/></manifest><spine></spine></package>';
  zip.file('META-INF/container.xml', containerXml);
  zip.file('OEBPS/content.opf', opfXml);
  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('stream-body', () => {
  describe('withByteCap', () => {
    it('passes bytes through unchanged when under the cap', async () => {
      const source = new ReadableStream<Uint8Array>({
        start: (c) => {
          c.enqueue(new Uint8Array([1, 2, 3]));
          c.enqueue(new Uint8Array([4, 5, 6]));
          c.close();
        },
      });
      const { stream, counter } = withByteCap(source, 100);
      const reader = stream.getReader();
      const chunks: number[] = [];
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (!result.done) {
          for (const b of result.value) chunks.push(b);
        }
      }
      expect(chunks).toEqual([1, 2, 3, 4, 5, 6]);
      expect(counter.total).toBe(6);
    });

    it('errors with MaxBodySizeError when the cap is exceeded', async () => {
      const source = new ReadableStream<Uint8Array>({
        start: (c) => {
          c.enqueue(new Uint8Array(50));
          c.enqueue(new Uint8Array(60));
          c.close();
        },
      });
      const { stream } = withByteCap(source, 100);
      const reader = stream.getReader();
      await reader.read();
      await expect(reader.read()).rejects.toBeInstanceOf(MaxBodySizeError);
    });

    it('exposes DEFAULT_MAX_BODY_BYTES = 200 MB', () => {
      expect(DEFAULT_MAX_BODY_BYTES).toBe(200 * 1024 * 1024);
    });
  });
});

describe('Admin Upload Route — streaming path (V12)', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });
    mockQueryFirst.mockResolvedValue({ id: 'book-1', slug: 'book-slug' });
  });

  it('uploads a small EPUB via the streaming body and validates it', async () => {
    const putSpy = vi.spyOn(env.BOOKS_BUCKET, 'put');
    const epubBuffer = await makeEpubBuffer();

    const res = await app.fetch(
      new Request('http://localhost/api/admin/books/book-1/upload', {
        method: 'PUT',
        body: epubBuffer,
        headers: {
          'Content-Type': 'application/epub+zip',
          'Content-Length': String(epubBuffer.byteLength),
          'Authorization': 'Bearer admin-token',
        },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Hono Response.json() returns unknown
    const body = (await res.json()) as unknown as {
      ok: boolean;
      data: { storageKey: string; validation: { isValid: boolean } };
    };
    expect(body.ok).toBe(true);
    expect(body.data.storageKey).toMatch(/^books\/book-1\/[^/]+\.epub$/);
    expect(body.data.validation.isValid).toBe(true);
    // The R2 put was called with a streamable body.
    expect(putSpy).toHaveBeenCalled();
    const callArgs = putSpy.mock.calls[0];
    expect(callArgs).toBeDefined();
    const bodyArg = callArgs?.[1];
    expect(bodyArg).toBeDefined();
    // ReadableStream in production, or the original ArrayBuffer in
    // test-pool environments where the runtime auto-buffers. Both are
    // acceptable so long as the upload succeeded.
    expect(['ReadableStream', 'ArrayBuffer']).toContain(
      bodyArg instanceof ReadableStream || bodyArg instanceof ArrayBuffer ? bodyArg.constructor.name : 'unknown',
    );
  });

  it('rejects a request with no Content-Length header', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/admin/books/book-1/upload', {
        method: 'PUT',
        body: 'whatever',
        headers: {
          'Content-Type': 'application/epub+zip',
          'Authorization': 'Bearer admin-token',
        },
      }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(400);
  });

  it('rejects an oversize Content-Length with 413 before any upload', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/admin/books/book-1/upload', {
        method: 'PUT',
        body: new ArrayBuffer(0),
        headers: {
          'Content-Type': 'application/epub+zip',
          'Content-Length': String(DEFAULT_MAX_BODY_BYTES + 1),
          'Authorization': 'Bearer admin-token',
        },
      }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(413);
  });

  it('rejects an empty body with 400', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/admin/books/book-1/upload', {
        method: 'PUT',
        body: new ArrayBuffer(0),
        headers: {
          'Content-Type': 'application/epub+zip',
          'Content-Length': '0',
          'Authorization': 'Bearer admin-token',
        },
      }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(400);
  });

  it('flags validationSkipped for very large uploads and still streams to R2', async () => {
    const putSpy = vi.spyOn(env.BOOKS_BUCKET, 'put');
    // Simulate a 30 MB payload (> 25 MB VALIDATION_THRESHOLD) by lying
    // about Content-Length; the body itself is a small buffer — the
    // streaming code will skip validation purely on the declared size.
    const declaredSize = 30 * 1024 * 1024;
    const tinyBody = new TextEncoder().encode('not-an-epub-but-large-declared-size');

    const res = await app.fetch(
      new Request('http://localhost/api/admin/books/book-1/upload', {
        method: 'PUT',
        body: tinyBody,
        headers: {
          'Content-Type': 'application/epub+zip',
          'Content-Length': String(declaredSize),
          'Authorization': 'Bearer admin-token',
        },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Hono Response.json() returns unknown
    const body = (await res.json()) as unknown as {
      ok: boolean;
      data: { validationSkipped?: boolean; validation?: unknown };
    };
    expect(body.ok).toBe(true);
    expect(body.data.validationSkipped).toBe(true);
    expect(body.data.validation).toBeUndefined();
    expect(putSpy).toHaveBeenCalled();
    const callArgs = putSpy.mock.calls[0];
    const customMetadata = callArgs?.[2]?.customMetadata;
    expect(customMetadata?.validationSkipped).toBe('true');
  });
});
