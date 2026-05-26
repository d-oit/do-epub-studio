import { describe, expect, it, vi, beforeEach } from 'vitest';
import { parseEpubInWorker, terminateParserWorker } from '../epub-parser-worker';
import type { EpubParseResult } from '../epub-parser-worker';

const mockArrayBuffer = new ArrayBuffer(8);

vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
  }),
);

vi.mock('../archive-validator', () => ({
  validateArchive: vi.fn().mockResolvedValue(undefined),
}));

describe('parseEpubInWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns valid result for valid Uint8Array data', async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const result: EpubParseResult = await parseEpubInWorker(data);
    expect(result.valid).toBe(true);
    expect(result.data).toBeInstanceOf(ArrayBuffer);
    expect(result.error).toBeUndefined();
  });

  it('returns valid result for valid URL string', async () => {
    const result: EpubParseResult = await parseEpubInWorker('https://example.com/book.epub');
    expect(result.valid).toBe(true);
    expect(result.data).toBeInstanceOf(ArrayBuffer);
    expect(result.error).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('https://example.com/book.epub');
  });

  it('returns error for fetch failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
    const result: EpubParseResult = await parseEpubInWorker('https://example.com/book.epub');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Network error');
    expect(result.data).toBeUndefined();
  });

  it('returns error for non-ok fetch response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    } as Response);
    const result: EpubParseResult = await parseEpubInWorker('https://example.com/book.epub');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Not Found');
    expect(result.data).toBeUndefined();
  });

  it('returns error when archive validation fails', async () => {
    const { validateArchive } = await import('../archive-validator');
    vi.mocked(validateArchive).mockRejectedValueOnce(new Error('Invalid archive'));
    const data = new Uint8Array([1, 2, 3]);
    const result: EpubParseResult = await parseEpubInWorker(data);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid archive');
    expect(result.data).toBeUndefined();
  });

  it('handles Uint8Array data with no error', async () => {
    const { validateArchive } = await import('../archive-validator');
    vi.mocked(validateArchive).mockResolvedValueOnce(undefined);
    const data = new Uint8Array([10, 20, 30]);
    const result: EpubParseResult = await parseEpubInWorker(data);
    expect(result.valid).toBe(true);
    expect(result.data).toBeInstanceOf(ArrayBuffer);
  });

  it('returns error for non-Error exceptions', async () => {
    vi.mocked(fetch).mockRejectedValueOnce('string error');
    const result: EpubParseResult = await parseEpubInWorker('https://example.com/book.epub');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('string error');
  });
});

describe('terminateParserWorker', () => {
  it('can be called safely', () => {
    expect(() => terminateParserWorker()).not.toThrow();
  });

  it('can be called multiple times', () => {
    terminateParserWorker();
    terminateParserWorker();
    expect(() => terminateParserWorker()).not.toThrow();
  });
});
