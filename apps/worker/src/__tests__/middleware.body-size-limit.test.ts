import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

function createMockExecutionCtx() {
  return { waitUntil: () => {}, passThroughOnException: () => {}, props: {} };
}

const ONE_MIB = 1_048_576;

describe('bodySizeLimit middleware', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('passes through a JSON body under 1 MiB', async () => {
    const payload = JSON.stringify({ ok: true });
    const ctx = createMockExecutionCtx();

    const res = await app.fetch(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(new TextEncoder().encode(payload).byteLength),
        },
        body: payload,
      }),
      {},
      ctx,
    );

    // Any non-413 response confirms the middleware did not block it.
    expect(res.status).not.toBe(413);
  });

  it('rejects when Content-Length header exceeds 1 MiB', async () => {
    const ctx = createMockExecutionCtx();

    const res = await app.fetch(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(ONE_MIB + 1),
        },
        // Body content doesn't matter — the Content-Length check fires first.
        body: 'x',
      }),
      {},
      ctx,
    );

    expect(res.status).toBe(413);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string } } = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects a chunked body (no Content-Length) that exceeds 1 MiB', async () => {
    const ctx = createMockExecutionCtx();

    // Build a body just over 1 MiB as a ReadableStream so no Content-Length
    // is set automatically.
    const oversizedBytes = new Uint8Array(ONE_MIB + 1).fill(0x61); // 'a'
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(oversizedBytes);
        controller.close();
      },
    });

    const req = new Request('http://localhost/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      // @ts-expect-error — duplex is required in Node 18+ for streaming bodies
      duplex: 'half',
      body: stream,
    });

    // Remove Content-Length if the runtime set it automatically.
    const headers = new Headers(req.headers);
    headers.delete('Content-Length');
    const reqWithoutCL = new Request(req.url, {
      method: req.method,
      headers,
      // @ts-expect-error — duplex is required in Node 18+ for streaming bodies
      duplex: 'half',
      body: req.body,
    });

    const res = await app.fetch(reqWithoutCL, {}, ctx);

    expect(res.status).toBe(413);
    const body: { ok: boolean; data: Record<string, unknown>; error: { code: string } } = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('exempts the EPUB upload route from the body size limit', async () => {
    const ctx = createMockExecutionCtx();

    // A request to the upload route with Content-Length way over the limit
    // must NOT be rejected by bodySizeLimit (it may get a 401/404 from auth
    // or the route itself, but NOT a 413 from our middleware).
    const res = await app.fetch(
      new Request('http://localhost/api/admin/books/some-book-id/upload', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/epub+zip',
          'Content-Length': String(ONE_MIB * 50), // 50 MiB — well over the cap
        },
        body: 'fake-epub-bytes',
      }),
      {},
      ctx,
    );

    // The middleware must not have blocked it (401 or 404 from auth is fine).
    expect(res.status).not.toBe(413);
  });
});
