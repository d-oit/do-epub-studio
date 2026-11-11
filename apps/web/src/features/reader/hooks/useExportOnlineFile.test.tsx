import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';
import { useExportOnlineFile } from './useExportOnlineFile';

vi.mock('../../../lib/api', () => ({ api: { get: vi.fn() } }));
const mockApiGet = vi.mocked(api.get);
const downloads: string[] = [];
const objectUrls = {
  createObjectURL: vi.fn((_blob: Blob) => 'blob:annotation-export'),
  revokeObjectURL: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  downloads.length = 0;
  useAuthStore.setState({ bookId: 'book-1', sessionToken: 'reader-token' });
  vi.stubGlobal('URL', objectUrls);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useExportOnlineFile', () => {
  it('downloads HTML content from the authenticated JSON response', async () => {
    mockApiGet.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { format: 'html', title: 'Book', content: '<html>Notes</html>' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const { result } = renderHook(() => useExportOnlineFile());
    let downloaded = false;

    await act(async () => {
      downloaded = await result.current.downloadOnlineExport('html');
    });

    expect(downloaded).toBe(true);
    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/books/book-1/export?format=html',
      expect.objectContaining({ token: 'reader-token' }),
    );
    expect(downloads).toEqual(['annotations.html']);
    const blob = objectUrls.createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob?.text()).toBe('<html>Notes</html>');
    expect(blob?.type).toBe('text/html;charset=utf-8');
    expect(objectUrls.revokeObjectURL).toHaveBeenCalledWith('blob:annotation-export');
  });

  it('downloads only an EPUB media type and reports failed server responses', async () => {
    mockApiGet.mockResolvedValueOnce(
      new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
        status: 200,
        headers: { 'content-type': 'application/epub+zip' },
      }),
    );
    const { result } = renderHook(() => useExportOnlineFile());
    let downloaded = false;

    await act(async () => {
      downloaded = await result.current.downloadOnlineExport('epub');
    });

    expect(downloaded).toBe(true);
    expect(downloads).toEqual(['annotations.epub']);

    mockApiGet.mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    await act(async () => {
      downloaded = await result.current.downloadOnlineExport('epub');
    });
    expect(downloaded).toBe(false);
    expect(result.current.hasError).toBe(true);
    expect(downloads).toEqual(['annotations.epub']);
  });
});
