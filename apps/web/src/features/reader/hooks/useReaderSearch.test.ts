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

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    vi.useRealTimers();
    await waitFor(() => expect(result.current.isSearching).toBe(false), { timeout: 5000 });
    expect(result.current.results).toEqual([]);
  });
});

describe('bounded concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limits concurrent loads to MAX_CONCURRENT (4) with 10 spine items', async () => {
    let concurrentLoads = 0;
    let peakConcurrent = 0;

    const sections: MockSection[] = Array.from({ length: 10 }, (_, i) => ({
      load: vi.fn(() => {
        concurrentLoads++;
        peakConcurrent = Math.max(peakConcurrent, concurrentLoads);
        return Promise.resolve().then(() => { concurrentLoads--; });
      }),
      find: vi.fn(() => []),
      unload: vi.fn(),
      href: `ch${i}.xhtml`,
    }));

    const book = {
      spine: {
        each: vi.fn((cb: (item: MockSection) => void) => { sections.forEach(cb); }),
        get: vi.fn(),
      },
      load: vi.fn(),
      navigation: { toc: [] },
    } as unknown as Book;

    vi.useFakeTimers();
    const { result } = renderHook(() => useReaderSearch(book, 'hello'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // Workers start synchronously inside the debounce callback; 4 workers each call load()
    expect(peakConcurrent).toBeLessThanOrEqual(4);
    expect(peakConcurrent).toBe(4);

    vi.useRealTimers();
    await waitFor(() => expect(result.current.isSearching).toBe(false), { timeout: 5000 });
  });

  it('stops loading after MAX_RESULTS (50) are found', async () => {
    let loadCount = 0;

    const sections: MockSection[] = Array.from({ length: 100 }, (_, i) => ({
      load: vi.fn(() => {
        loadCount++;
        return Promise.resolve();
      }),
      find: vi.fn(() => [{ cfi: `cfi${i}`, excerpt: `match ${i}` }]),
      unload: vi.fn(),
      href: `ch${i}.xhtml`,
    }));

    const book = {
      spine: {
        each: vi.fn((cb: (item: MockSection) => void) => { sections.forEach(cb); }),
        get: vi.fn(),
      },
      load: vi.fn(),
      navigation: { toc: [] },
    } as unknown as Book;

    vi.useFakeTimers();
    const { result } = renderHook(() => useReaderSearch(book, 'match'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    vi.useRealTimers();
    await waitFor(() => expect(result.current.isSearching).toBe(false), { timeout: 5000 });
    expect(result.current.results).toHaveLength(50);
    // Not all 100 sections needed to be loaded
    expect(loadCount).toBeLessThanOrEqual(54);
  });

  it('cancels previous search when a new one starts', async () => {
    let loadCount = 0;
    const sections: MockSection[] = Array.from({ length: 10 }, (_, i) => ({
      load: vi.fn(() => {
        loadCount++;
        return Promise.resolve();
      }),
      find: vi.fn(() => []),
      unload: vi.fn(),
      href: `ch${i}.xhtml`,
    }));

    const book = {
      spine: {
        each: vi.fn((cb: (item: MockSection) => void) => { sections.forEach(cb); }),
        get: vi.fn(),
      },
      load: vi.fn(),
      navigation: { toc: [] },
    } as unknown as Book;

    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ q }) => useReaderSearch(book, q),
      { initialProps: { q: 'first' } },
    );

    // Start first search — 4 workers begin loading
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    const firstSearchLoads = loadCount;

    // Start a new search while old one is in-flight — old search gets cancelled
    await act(async () => {
      rerender({ q: 'second' });
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    vi.useRealTimers();
    await waitFor(() => expect(result.current.isSearching).toBe(false), { timeout: 5000 });
    // The new search ran and loaded sections
    expect(loadCount).toBeGreaterThan(firstSearchLoads);
  });

  it('always calls unload on every loaded section (finally block)', async () => {
    const resolvers = new Map<number, () => void>();
    const sections: MockSection[] = Array.from({ length: 6 }, (_, i) => ({
      load: vi.fn(() => new Promise<void>((r) => { resolvers.set(i, r); })),
      find: vi.fn(() => []),
      unload: vi.fn(),
      href: `ch${i}.xhtml`,
    }));

    const book = {
      spine: {
        each: vi.fn((cb: (item: MockSection) => void) => { sections.forEach(cb); }),
        get: vi.fn(),
      },
      load: vi.fn(),
      navigation: { toc: [] },
    } as unknown as Book;

    vi.useFakeTimers();
    const { result } = renderHook(() => useReaderSearch(book, 'test'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // The first four workers are parked on a pending `load` (MAX_CONCURRENT=4);
    // sections 5 and 6 are only reached once those loads resolve.
    expect(resolvers.size).toBe(4);

    // Release the first four loads inside act() so the workers' continuations —
    // `find`, `unload`, and picking up the next section — settle within React's
    // act scope. Each released worker then parks on section 5 or 6.
    await act(async () => {
      for (const resolve of resolvers.values()) resolve();
      await Promise.resolve();
    });

    // The freed workers started the remaining two sections.
    expect(resolvers.size).toBe(6);

    // Release the last two loads and let the search reach its terminal state.
    await act(async () => {
      for (const resolve of resolvers.values()) resolve();
      await Promise.resolve();
    });

    vi.useRealTimers();
    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
    }, { timeout: 5000 });

    sections.forEach((section) => {
      expect(section.unload).toHaveBeenCalled();
    });
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
