import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReaderSearch, highlightRanges } from './useReaderSearch';
import type { Book } from '@intity/epub-js';

interface MockSection {
  load: (loader: unknown) => Promise<void>;
  find: (query: string) => Array<{ cfi: string; excerpt: string }>;
  unload: () => void;
  href: string;
}

function makeMockBook(overrides?: { findResult?: (q: string) => Array<{ cfi: string; excerpt: string }> }) {
  const findResult = overrides?.findResult ?? (() => []);
  const section: MockSection = {
    load: vi.fn().mockResolvedValue(undefined),
    find: findResult,
    unload: vi.fn(),
    href: 'chapter1.xhtml',
  };
  return {
    spine: {
      each: vi.fn((cb: (item: MockSection) => void) => {
        cb(section);
      }),
      get: vi.fn(() => section),
    },
    load: vi.fn(),
    navigation: {
      toc: [{ label: 'Chapter 1', href: 'chapter1.xhtml' }],
    },
  } as unknown as Book;
}

describe('useReaderSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty results for empty query', () => {
    const mockBook = makeMockBook();
    const { result } = renderHook(() => useReaderSearch(mockBook, ''));
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it('searches and returns results after debounce', async () => {
    vi.useFakeTimers();
    const mockBook = makeMockBook({
      findResult: (q) => (q === 'fox' ? [{ cfi: 'cfi1', excerpt: 'the fox jumps' }] : []),
    });
    const { result } = renderHook(() => useReaderSearch(mockBook, 'fox'));

    act(() => {
      vi.advanceTimersByTime(300);
    });

    vi.useRealTimers();
    await waitFor(() => expect(result.current.results.length).toBe(1), { timeout: 5000 });
    expect(result.current.isSearching).toBe(false);
    expect(result.current.results[0]).toMatchObject({
      cfi: 'cfi1',
      excerpt: 'the fox jumps',
      chapterTitle: 'Chapter 1',
    });
  });

  it('handles section load failure without crashing', async () => {
    vi.useFakeTimers();
    const mockBook = {
      spine: {
        each: vi.fn((cb: (item: MockSection) => void) => {
          cb({
            load: vi.fn().mockRejectedValue(new Error('network')),
            find: vi.fn(),
            unload: vi.fn(),
            href: 'broken.xhtml',
          });
        }),
        get: vi.fn(() => undefined),
      },
      load: vi.fn(),
      navigation: { toc: [] },
    } as unknown as Book;
    const { result } = renderHook(() => useReaderSearch(mockBook, 'fox'));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    vi.useRealTimers();
    await waitFor(() => expect(result.current.isSearching).toBe(false), { timeout: 5000 });
    expect(result.current.results).toEqual([]);
  });
});

describe('highlightRanges', () => {
  it('returns empty array for empty excerpt', () => {
    expect(highlightRanges('', 'fox')).toEqual([]);
  });

  it('returns single non-hit part for empty query', () => {
    expect(highlightRanges('hello', '')).toEqual([{ text: 'hello', hit: false }]);
  });

  it('marks matching substring as hit', () => {
    const parts = highlightRanges('the fox jumps', 'fox');
    expect(parts).toEqual([
      { text: 'the ', hit: false },
      { text: 'fox', hit: true },
      { text: ' jumps', hit: false },
    ]);
  });

  it('marks multiple matches', () => {
    const parts = highlightRanges('fox and fox', 'fox');
    expect(parts.filter((p) => p.hit)).toHaveLength(2);
  });
});
