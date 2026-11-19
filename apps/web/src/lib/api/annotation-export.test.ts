import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPORT_EPUB_DEADLINE_MS, fetchAnnotationExport } from './annotation-export';

const { mockApiRequest } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
}));

vi.mock('./core', () => ({ apiRequest: mockApiRequest }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchAnnotationExport', () => {
  it('requests EPUB bytes with the overall deadline and array-buffer response', async () => {
    mockApiRequest.mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    const blob = await fetchAnnotationExport('book-1', 'epub', 'token');
    expect(mockApiRequest).toHaveBeenCalledWith(
      '/api/books/book-1/export?format=epub',
      expect.objectContaining({
        token: 'token',
        responseType: 'arrayBuffer',
        timeoutMs: EXPORT_EPUB_DEADLINE_MS,
        signal: expect.any(AbortSignal),
      }),
    );
    expect(blob.type).toBe('application/epub+zip');
  });

  it('requests JSON HTML and wraps it as a text/html blob', async () => {
    mockApiRequest.mockResolvedValue({
      format: 'html',
      title: 'Book',
      content: '<html>Notes</html>',
    });
    const externalSignal = new AbortController().signal;
    const blob = await fetchAnnotationExport('book-1', 'html', 'token', externalSignal);
    expect(mockApiRequest).toHaveBeenCalledWith(
      '/api/books/book-1/export?format=html',
      expect.objectContaining({
        token: 'token',
        signal: externalSignal,
      }),
    );
    expect(mockApiRequest.mock.calls[0]?.[1]).not.toHaveProperty('responseType');
    expect(blob.type).toBe('text/html;charset=utf-8');
    expect(await blob.text()).toBe('<html>Notes</html>');
  });

  it('forwards caller cancellation to the EPUB request signal', async () => {
    const requestSignal: { signal: AbortSignal | null } = { signal: null };
    mockApiRequest.mockImplementation((_endpoint: string, options?: { signal?: AbortSignal }) => {
      const { promise, reject } = Promise.withResolvers<ArrayBuffer>();
      requestSignal.signal = options?.signal ?? null;
      requestSignal.signal?.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError')),
      );
      return promise;
    });
    const caller = new AbortController();
    const pending = fetchAnnotationExport('book-1', 'epub', 'token', caller.signal);
    caller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(requestSignal.signal?.aborted).toBe(true);
  });

  it('aborts the EPUB request when the overall deadline elapses', async () => {
    const requestSignal: { signal: AbortSignal | null } = { signal: null };
    mockApiRequest.mockImplementation((_endpoint: string, options?: { signal?: AbortSignal }) => {
      const { promise } = Promise.withResolvers<ArrayBuffer>();
      requestSignal.signal = options?.signal ?? null;
      return promise;
    });
    void fetchAnnotationExport('book-1', 'epub', 'token');
    await vi.advanceTimersByTimeAsync(EXPORT_EPUB_DEADLINE_MS);
    expect(requestSignal.signal?.aborted).toBe(true);
  });
});
