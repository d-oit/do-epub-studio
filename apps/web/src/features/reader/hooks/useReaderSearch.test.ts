import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReaderSearch } from './useReaderSearch';

describe('useReaderSearch', () => {
  const mockBook = {
    spine: {
      each: vi.fn((cb) => {
        cb({
          load: () => Promise.resolve(),
          find: (q: string) => (q === 'fox' ? [{ cfi: 'cfi1', excerpt: 'the fox jumps' }] : []),
          unload: vi.fn(),
          href: 'chapter1.xhtml'
        });
      }),
      get: vi.fn(() => ({ href: 'chapter1.xhtml' })),
    },
    load: {
      bind: vi.fn(),
    },
    navigation: {
      toc: [{ label: 'Chapter 1', href: 'chapter1.xhtml' }],
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty results for empty query', () => {
    const { result } = renderHook(() => useReaderSearch(mockBook, ''));
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it('searches and returns results after debounce', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReaderSearch(mockBook, 'fox'));

    expect(result.current.isSearching).toBe(false);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    vi.useRealTimers();
    await waitFor(() => expect(result.current.results.length).toBe(1), { timeout: 5000 });
    expect(result.current.results[0]).toMatchObject({
      cfi: 'cfi1',
      snippet: 'the <mark>fox</mark> jumps',
      chapterTitle: 'Chapter 1',
    });
  });
});
