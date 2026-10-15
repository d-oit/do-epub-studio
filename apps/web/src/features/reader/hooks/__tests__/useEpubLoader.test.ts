import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useEpubLoader } from '../useEpubLoader';

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('../../../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
  createPerformanceMark: vi.fn(),
  observePerformance: vi.fn(),
  reportPerformanceMetrics: vi.fn(),
}));

const { mockBook, createEpubLoaderMock } = vi.hoisted(() => {
  const book = {
    ready: Promise.resolve(),
    loaded: {
      navigation: Promise.resolve({ toc: [{ label: 'Chapter 1', href: 'ch1.xhtml' }] }),
      metadata: Promise.resolve(new Map()),
    },
    packaging: { direction: 'ltr', metadata: new Map() },
    destroy: vi.fn(),
  };
  return {
    mockBook: book,
    createEpubLoaderMock: vi.fn(() => ({
      load: vi.fn().mockResolvedValue(undefined),
      getBook: vi.fn(() => book),
      destroy: vi.fn(),
    })),
  };
});

vi.mock('@do-epub-studio/reader-core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    createEpubLoader: createEpubLoaderMock,
  };
});

const mockReaderStore: Record<string, unknown> = {
  setError: vi.fn(),
  setBookDirection: vi.fn(),
  setIsFixedLayout: vi.fn(),
};

const mockAuthState = {
  bookId: 'test-book-id',
};

vi.mock('../../../stores', async () => {
  const actual = await vi.importActual('../../../stores');
  return {
    ...actual,
    useAuthStore: (selector: ((s: typeof mockAuthState) => unknown) | undefined) =>
      selector ? selector(mockAuthState) : mockAuthState,
    useReaderStore: (selector: ((s: typeof mockReaderStore) => unknown) | undefined) =>
      selector ? selector(mockReaderStore) : mockReaderStore,
  };
});

describe('useEpubLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads EPUB and resolves navigation TOC and metadata', async () => {
    const { result } = renderHook(() => useEpubLoader('http://example.com/test.epub'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(createEpubLoaderMock).toHaveBeenCalled();
    expect(result.current.book).toBe(mockBook);
    expect(result.current.toc).toEqual([{ label: 'Chapter 1', href: 'ch1.xhtml' }]);
    expect(result.current.bookDirection).toBe('ltr');
  });

  it('handles null epubUrl gracefully', async () => {
    const { result } = renderHook(() => useEpubLoader(null));

    expect(result.current.book).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(createEpubLoaderMock).not.toHaveBeenCalled();
  });
});
