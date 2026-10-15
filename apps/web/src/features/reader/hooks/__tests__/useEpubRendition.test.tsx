import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useEpubRendition } from '../useEpubRendition';
import type { Theme, FontSize } from '../../../../stores';

vi.mock('../../../../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
  createPerformanceMark: vi.fn(),
  measurePerformance: vi.fn(),
}));

const mockRendition = {
  themes: { registerRules: vi.fn(), select: vi.fn() },
  hooks: { content: { register: vi.fn() } },
  display: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn(),
  location: { start: { cfi: 'epubcfi(/6/2)' } },
};

const mockBook = {
  renderTo: vi.fn(() => mockRendition),
} as unknown as import('@intity/epub-js').Book;

const mockPreferencesState = {
  reader: {
    theme: 'light' as Theme,
    fontSize: 'medium' as FontSize,
    fontFamily: 'serif' as const,
    lineHeight: 2,
    direction: 'default' as const,
    writingMode: 'horizontal-tb' as const,
  },
};

const mockReaderStore = {
  readerSpread: 'auto' as const,
  readerZoom: 1.0,
};

vi.mock('../../../../stores', async () => {
  const actual = await vi.importActual('../../../../stores');
  return {
    ...actual,
    useAuthStore: () => ({ bookId: 'test-book' }),
    useReaderStore: (selector: ((s: typeof mockReaderStore) => unknown) | undefined) =>
      selector ? selector(mockReaderStore) : mockReaderStore,
    usePreferencesStore: (selector: ((s: typeof mockPreferencesState) => unknown) | undefined) =>
      selector ? selector(mockPreferencesState) : mockPreferencesState,
  };
});

describe('useEpubRendition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders rendition into viewer container', async () => {
    const viewer = document.createElement('div');
    const root = document.createElement('div');

    const { result } = renderHook(() =>
      useEpubRendition({
        book: mockBook,
        viewerRef: { current: viewer },
        rootRef: { current: root },
        bookDirection: 'ltr',
        isFixedLayout: false,
        initialProgressCfi: 'epubcfi(/6/2!/4/2)',
      }),
    );

    await waitFor(() => {
      expect(mockBook.renderTo).toHaveBeenCalledWith(viewer, expect.anything());
    });

    await waitFor(() => {
      expect(mockRendition.display).toHaveBeenCalledWith('epubcfi(/6/2!/4/2)');
    });

    expect(result.current.resolvedTheme).toBe('light');
  });
});
