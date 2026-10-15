import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useEpubNavigation } from '../useEpubNavigation';

const mockRendition = {
  on: vi.fn(),
  next: vi.fn(),
  prev: vi.fn(),
  location: { start: { href: 'ch1.xhtml' } },
};

const mockBook = {
  spine: [{ href: 'ch1.xhtml' }, { href: 'ch2.xhtml' }],
} as unknown as import('@intity/epub-js').Book;

const mockAdapter = {
  scheduleRender: vi.fn(),
};

vi.mock('../../../../stores', async () => {
  const actual = await vi.importActual('../../../../stores');
  return {
    ...actual,
    useAuthStore: () => ({ sessionToken: 'mock-token', bookId: 'mock-book-id' }),
    useReaderStore: Object.assign(
      (selector: (s: { setCurrentChapter: typeof vi.fn }) => unknown) =>
        selector({ setCurrentChapter: vi.fn() }),
      {
        getState: () => ({ setProgress: vi.fn() }),
      },
    ),
  };
});

describe('useEpubNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('sets initial location and registers relocated event', async () => {
    const highlightsRef = { current: [] };
    const commentsRef = { current: [] };
    const onNavigateToAnnotationRef = { current: vi.fn() };
    const adapterRef = { current: mockAdapter as unknown as import('@do-epub-studio/reader-core').AnnotationAdapter };

    const { result } = renderHook(() =>
      useEpubNavigation({
        rendition: mockRendition as unknown as import('@intity/epub-js').Rendition,
        book: mockBook,
        toc: [],
        bookDirection: 'ltr',
        highlightsRef,
        commentsRef,
        onNavigateToAnnotationRef,
        adapterRef,
      }),
    );

    expect(result.current.currentChapterRef.current).toBe('ch1.xhtml');
    expect(mockRendition.on).toHaveBeenCalledWith('relocated', expect.any(Function));
  });

  it('handles arrow key navigation', async () => {
    const highlightsRef = { current: [] };
    const commentsRef = { current: [] };
    const onNavigateToAnnotationRef = { current: vi.fn() };
    const adapterRef = { current: mockAdapter as unknown as import('@do-epub-studio/reader-core').AnnotationAdapter };

    renderHook(() =>
      useEpubNavigation({
        rendition: mockRendition as unknown as import('@intity/epub-js').Rendition,
        book: mockBook,
        toc: [],
        bookDirection: 'ltr',
        highlightsRef,
        commentsRef,
        onNavigateToAnnotationRef,
        adapterRef,
      }),
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });

    expect(mockRendition.next).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    });

    expect(mockRendition.prev).toHaveBeenCalledTimes(1);
  });
});
