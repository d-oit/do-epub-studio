import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import { useReaderEpub } from './useReaderEpub';
import type { Theme, FontSize } from '../../../stores';

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));

vi.mock('../../../lib/api', () => ({
  apiRequest: vi.fn().mockResolvedValue({ locator: null, progressPercent: 0 }),
  API_BASE_URL: 'http://localhost:8787',
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  getApiUrl: vi.fn(),
}));

vi.mock('../../../lib/offline', () => ({
  saveProgress: vi.fn(),
  queueSync: vi.fn(),
  getProgress: vi.fn(),
  generateMutationId: vi.fn(() => 'mock-mutation-id'),
}));

const { mockRendition, mockBook, mockEpubFn } = vi.hoisted(() => {
  const rendition = {
    themes: { registerRules: vi.fn(), select: vi.fn() },
    hooks: {
      content: { register: vi.fn() },
      render: { register: vi.fn() },
    },
    display: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    annotations: {
      append: vi.fn(),
      remove: vi.fn(),
      [Symbol.iterator]: function* () {
        yield* [].entries();
      },
    },
    next: vi.fn(),
    prev: vi.fn(),
    destroy: vi.fn(),
    location: null,
  };
  const book = {
    ready: Promise.resolve(),
    loaded: {
      navigation: Promise.resolve({ toc: [] }),
      metadata: Promise.resolve(new Map()),
    },
    packaging: { direction: 'default', metadata: new Map() },
    renderTo: vi.fn(() => rendition),
    destroy: vi.fn(),
  };
  return {
    mockRendition: rendition,
    mockBook: book,
    mockEpubFn: vi.fn(() => book),
  };
});

vi.mock('@intity/epub-js', () => ({ default: mockEpubFn }));

const mockReaderStore: Record<string, unknown> = {
  setProgress: vi.fn(),
  setError: vi.fn(),
  setCurrentChapter: vi.fn(),
  setBookDirection: vi.fn(),
  setBookWritingMode: vi.fn(),
  setIsFixedLayout: vi.fn(),
};

const mockPreferencesState = {
  reader: {
    theme: 'light' as Theme,
    fontSize: 'medium' as FontSize,
    fontFamily: 'serif' as const,
    lineHeight: 2,
    pageWidth: 'normal' as const,
    direction: 'default' as const,
    writingMode: 'horizontal-tb' as const,
  },
};

const mockAuthState = {
  sessionToken: 'mock-token',
  bookId: 'mock-book-id',
};

vi.mock('../../../stores', async () => {
  const actual = await vi.importActual('../../../stores');
  return {
    ...actual,
    useAuthStore: (selector: ((s: typeof mockAuthState) => unknown) | undefined) =>
      selector ? selector(mockAuthState) : mockAuthState,
    useReaderStore: (selector: ((s: typeof mockReaderStore) => unknown) | undefined) =>
      selector ? selector(mockReaderStore) : mockReaderStore,
    usePreferencesStore: (selector: ((s: typeof mockPreferencesState) => unknown) | undefined) =>
      selector ? selector(mockPreferencesState) : mockPreferencesState,
  };
});

function createRefs() {
  const viewer = document.createElement('div');
  const root = document.createElement('div');
  root.style.setProperty('--color-background', '#fff');
  root.style.setProperty('--color-foreground', '#000');
  const highlightsRef = { current: [] };
  const commentsRef = { current: [] };
  return {
    viewerRef: { current: viewer },
    rootRef: { current: root },
    highlightsRef,
    commentsRef,
  };
}

describe('useReaderEpub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('initializes Rendition from epubUrl', async () => {
    const refs = createRefs();
    const onNavigate = vi.fn();

    renderHook(() =>
      useReaderEpub('http://test.epub', refs.viewerRef, refs.rootRef, refs.highlightsRef, refs.commentsRef, onNavigate),
    );

    await waitFor(() => {
      expect(mockEpubFn).toHaveBeenCalledWith('http://test.epub');
    });

    await waitFor(() => {
      expect(mockBook.renderTo).toHaveBeenCalledWith(refs.viewerRef.current, {
        width: '100%',
        height: '100%',
        spread: 'auto',
        sandbox: ['allow-same-origin', 'allow-scripts'],
      });
    });

    await waitFor(() => {
      expect(mockRendition.display).toHaveBeenCalled();
    });
  });

  it('does not initialize when epubUrl is null', async () => {
    const refs = createRefs();
    const onNavigate = vi.fn();

    renderHook(() =>
      useReaderEpub(null, refs.viewerRef, refs.rootRef, refs.highlightsRef, refs.commentsRef, onNavigate),
    );

    await waitFor(() => {
      expect(mockEpubFn).not.toHaveBeenCalled();
    });
  });

  it('detects fixed-layout from packaging metadata', async () => {
    const refs = createRefs();
    const onNavigate = vi.fn();

    mockBook.packaging = {
      direction: 'default',
      metadata: new Map([['layout', 'pre-paginated']]),
    };

    renderHook(() =>
      useReaderEpub('http://test.epub', refs.viewerRef, refs.rootRef, refs.highlightsRef, refs.commentsRef, onNavigate),
    );

    await waitFor(() => {
      expect(mockReaderStore.setIsFixedLayout).toHaveBeenCalledWith(true);
    });
  });

  it('applies defaultDirection option based on packaging direction', async () => {
    const refs = createRefs();

    const onNavigate = vi.fn();
    renderHook(() =>
      useReaderEpub('http://test.epub', refs.viewerRef, refs.rootRef, refs.highlightsRef, refs.commentsRef, onNavigate),
    );

    await waitFor(() => {
      expect(mockBook.renderTo).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ defaultDirection: undefined }),
      );
    });
  });

  it('registers relocated and displayed event handlers', async () => {
    const refs = createRefs();
    const onNavigate = vi.fn();

    renderHook(() =>
      useReaderEpub('http://test.epub', refs.viewerRef, refs.rootRef, refs.highlightsRef, refs.commentsRef, onNavigate),
    );

    await waitFor(() => {
      expect(mockRendition.on).toHaveBeenCalledWith('relocated', expect.any(Function));
    });

    await waitFor(() => {
      expect(mockRendition.on).toHaveBeenCalledWith('displayed', expect.any(Function));
    });
  });

  describe('keyboard navigation', () => {
    function setupAndFlush() {
      const refs = createRefs();
      const onNavigate = vi.fn();
      const hook = renderHook(() =>
        useReaderEpub('http://test.epub', refs.viewerRef, refs.rootRef, refs.highlightsRef, refs.commentsRef, onNavigate),
      );
      return hook;
    }

    it('calls rendition.next on ArrowRight keydown', async () => {
      setupAndFlush();

      await waitFor(() => {
        expect(mockRendition.display).toHaveBeenCalled();
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });

      expect(mockRendition.next).toHaveBeenCalledTimes(1);
      expect(mockRendition.prev).not.toHaveBeenCalled();
    });

    it('calls rendition.prev on ArrowLeft keydown', async () => {
      setupAndFlush();

      await waitFor(() => {
        expect(mockRendition.display).toHaveBeenCalled();
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      });

      expect(mockRendition.prev).toHaveBeenCalledTimes(1);
      expect(mockRendition.next).not.toHaveBeenCalled();
    });

    it('does not respond to other keys', async () => {
      setupAndFlush();

      await waitFor(() => {
        expect(mockRendition.next).not.toHaveBeenCalled();
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });

      expect(mockRendition.next).not.toHaveBeenCalled();
      expect(mockRendition.prev).not.toHaveBeenCalled();
    });

    it('cleans up event listener on unmount', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = setupAndFlush();

      await waitFor(() => {
        expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      });

      act(() => {
        unmount();
      });

      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });
});
