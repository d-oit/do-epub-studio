import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Rendition } from '@intity/epub-js';
import type {
  AnnotationAdapter,
  CommentRecord,
  HighlightRecord,
} from '@do-epub-studio/reader-core';
import type { PageDirection, ReaderZoom } from '../../../../stores';
import type { Theme } from '../../../../stores/preferences';
import type { LoadedEpub } from '../useEpubLoader';
import type { PrefetchManager } from '../../../../lib/prefetch-manager';
import { useEpubLoader } from '../useEpubLoader';
import { useEpubRendition } from '../useEpubRendition';
import { useEpubNavigation, type AnnotationNavigation } from '../useEpubNavigation';
import { useEpubAnnotationBridge } from '../useEpubAnnotationBridge';

const mocks = vi.hoisted(() => {
  const adapter = {
    scheduleRender: vi.fn(),
    clearAnnotations: vi.fn(),
    cancelScheduledRender: vi.fn(),
  };
  const rendition = {
    themes: { registerRules: vi.fn(), select: vi.fn() },
    hooks: { content: { register: vi.fn() }, render: { register: vi.fn() } },
    display: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    destroy: vi.fn(),
    location: { start: { href: 'chapter.xhtml', cfi: 'epubcfi(/6/4!/4)' } },
  };
  const book = {
    ready: Promise.resolve(),
    loaded: {
      navigation: Promise.resolve({ toc: [] as { label: string; href: string }[] }),
      metadata: Promise.resolve(new Map<string, string>()),
    },
    packaging: { direction: 'default', metadata: new Map<string, string>() },
    renderTo: vi.fn(() => rendition),
  };
  const loader = {
    load: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    getBook: vi.fn(() => book),
  };
  const readerState = {
    setError: vi.fn(),
    setBookDirection: vi.fn(),
    setIsFixedLayout: vi.fn(),
    setProgress: vi.fn(),
    setCurrentChapter: vi.fn(),
    readerSpread: 'auto',
    readerZoom: 1 as ReaderZoom,
    progress: { progressPercent: 0 },
  };
  const preferencesState = {
    reader: {
      theme: 'light' as Theme,
      fontSize: 'medium',
      fontFamily: 'serif',
      lineHeight: 1.5,
      direction: 'default',
      writingMode: 'horizontal-tb',
    },
  };
  const applyTheme = vi.fn();
  return {
    adapter,
    rendition,
    book,
    loader,
    readerState,
    preferencesState,
    createEpubLoader: vi.fn(() => loader),
    createEpubAnnotationAdapter: vi.fn(() => adapter),
    applyTheme,
    createThemeApplier: vi.fn(() => applyTheme),
    registerRenditionContentHooks: vi.fn(),
    logClientEvent: vi.fn(),
    createPerformanceMark: vi.fn(),
    measurePerformance: vi.fn(() => 1),
    observePerformance: vi.fn(() => null),
    reportPerformanceMetrics: vi.fn(),
  };
});

vi.mock('@do-epub-studio/reader-core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createEpubLoader: mocks.createEpubLoader,
    createEpubAnnotationAdapter: mocks.createEpubAnnotationAdapter,
  };
});

vi.mock('../../../../stores', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../../../stores');
  return {
    ...actual,
    useReaderStore: (selector: (state: typeof mocks.readerState) => unknown) =>
      selector(mocks.readerState),
    usePreferencesStore: (selector: (state: typeof mocks.preferencesState) => unknown) =>
      selector(mocks.preferencesState),
  };
});

vi.mock('../../../../lib/client-logger', () => ({
  logClientEvent: mocks.logClientEvent,
  createPerformanceMark: mocks.createPerformanceMark,
  measurePerformance: mocks.measurePerformance,
  observePerformance: mocks.observePerformance,
  reportPerformanceMetrics: mocks.reportPerformanceMetrics,
}));

vi.mock('../useReaderEpub.helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createThemeApplier: mocks.createThemeApplier,
    registerRenditionContentHooks: mocks.registerRenditionContentHooks,
  };
});

vi.mock('../../../../lib/reduced-motion', () => ({ getPrefersReducedMotion: () => false }));

function resetFixture(): void {
  mocks.readerState.readerSpread = 'auto';
  mocks.readerState.readerZoom = 1;
  mocks.preferencesState.reader.theme = 'light';
  mocks.preferencesState.reader.fontSize = 'medium';
  mocks.book.loaded.navigation = Promise.resolve({ toc: [] });
  mocks.book.loaded.metadata = Promise.resolve(new Map<string, string>());
  mocks.book.packaging = { direction: 'default', metadata: new Map<string, string>() };
  mocks.loader.load.mockResolvedValue(undefined);
  mocks.loader.getBook.mockReturnValue(mocks.book);
  mocks.createEpubLoader.mockReturnValue(mocks.loader);
  mocks.rendition.display.mockResolvedValue(undefined);
  mocks.rendition.location = { start: { href: 'chapter.xhtml', cfi: 'epubcfi(/6/4!/4)' } };
}

describe('decomposed EPUB hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFixture();
  });

  afterEach(() => cleanup());

  it('loads book metadata, TOC, direction, and presentation without mounting a rendition', async () => {
    mocks.book.loaded.navigation = Promise.resolve({
      toc: [{ label: 'Chapter One', href: 'chapter-one.xhtml' }],
    });
    mocks.book.loaded.metadata = Promise.resolve(new Map([['title', 'A Book']]));
    mocks.book.packaging = {
      direction: 'rtl',
      metadata: new Map([
        ['layout', 'pre-paginated'],
        ['spread', 'both'],
      ]),
    };

    const { result, unmount } = renderHook(() =>
      useEpubLoader({
        epubUrl: 'https://example.test/book.epub',
        bookId: 'book-1',
        t: (key) => key,
      }),
    );

    await waitFor(() => expect(result.current.loadedEpub).not.toBeNull());
    expect(mocks.loader.load).toHaveBeenCalledWith('https://example.test/book.epub');
    expect(result.current.toc).toEqual([{ label: 'Chapter One', href: 'chapter-one.xhtml' }]);
    expect(result.current.metadata?.title).toBe('A Book');
    expect(result.current.loadedEpub?.direction).toBe('rtl');
    expect(result.current.loadedEpub?.presentation.fixedLayout).toBe(true);
    expect(mocks.readerState.setBookDirection).toHaveBeenLastCalledWith('rtl');
    expect(mocks.readerState.setIsFixedLayout).toHaveBeenLastCalledWith(true);
    expect(mocks.book.renderTo).not.toHaveBeenCalled();
    unmount();
    expect(mocks.loader.destroy).toHaveBeenCalledOnce();
  });

  it('reapplies theme changes without recreating the book rendition', async () => {
    const loadedEpub = {
      book: mocks.book,
      direction: 'ltr',
      presentation: { bookInfo: { title: 'A Book' }, fixedLayout: false },
      toc: [],
    } as unknown as LoadedEpub;
    const renditionRef = { current: null as Rendition | null };
    const adapterRef = { current: null as AnnotationAdapter | null };
    const fixedLayoutRef = { current: false };
    const zoomRef = { current: 1 as ReaderZoom };
    const progressFlushRef = { current: null as (() => Promise<void>) | null };
    const viewerRef = { current: document.createElement('div') };
    const rootRef = { current: document.createElement('div') };

    const { result, rerender } = renderHook(
      ({ theme }: { theme: Theme }) => {
        mocks.preferencesState.reader.theme = theme;
        return useEpubRendition({
          bookId: 'book-1',
          loadedEpub,
          viewerRef,
          rootRef,
          renditionRef,
          adapterRef,
          fixedLayoutRef,
          zoomRef,
          progressFlushRef,
          t: (key) => key,
        });
      },
      { initialProps: { theme: 'light' as Theme } },
    );

    await waitFor(() => expect(result.current).toBe(mocks.rendition));
    await waitFor(() => expect(mocks.applyTheme).toHaveBeenCalledWith(mocks.rendition));
    const initialThemeApplications = mocks.applyTheme.mock.calls.length;
    rerender({ theme: 'dark' });
    await waitFor(() =>
      expect(mocks.applyTheme).toHaveBeenCalledTimes(initialThemeApplications + 1),
    );
    expect(mocks.book.renderTo).toHaveBeenCalledOnce();
    expect(mocks.rendition.destroy).not.toHaveBeenCalled();
  });

  it('displays the saved CFI and keeps keyboard navigation on the mounted rendition', async () => {
    const rendition = mocks.rendition as unknown as Rendition;
    const currentChapterRef = { current: null as string | null };
    const adapterRef = { current: mocks.adapter as unknown as AnnotationAdapter };
    const directionRef = { current: 'ltr' as PageDirection };
    const highlightsRef = { current: [] as HighlightRecord[] };
    const commentsRef = { current: [] as CommentRecord[] };
    const onNavigateToAnnotationRef = { current: vi.fn() as AnnotationNavigation };
    const prefetchMock = { onChapterChange: vi.fn() };
    const prefetchManagerRef = { current: prefetchMock as unknown as PrefetchManager };
    const progressFlushRef = { current: null as (() => Promise<void>) | null };
    const scheduleAnnotations = vi.fn();
    const savedCfi = 'epubcfi(/6/999!/4)';

    const { rerender } = renderHook(
      ({ progressCfi }: { progressCfi: string }) =>
        useEpubNavigation({
          rendition,
          directionRef,
          toc: [{ label: 'Chapter', href: 'chapter.xhtml' }],
          bookId: 'book-1',
          sessionToken: 'session-token',
          progressCfi,
          currentChapterRef,
          highlightsRef,
          commentsRef,
          adapterRef,
          onNavigateToAnnotationRef,
          prefetchManagerRef,
          progressFlushRef,
          scheduleAnnotations,
          t: (key) => key,
        }),
      { initialProps: { progressCfi: savedCfi } },
    );

    await waitFor(() => expect(mocks.rendition.display).toHaveBeenCalledWith(savedCfi));
    expect(scheduleAnnotations).toHaveBeenCalled();
    expect(currentChapterRef.current).toBe('chapter.xhtml');
    expect(mocks.readerState.setCurrentChapter).toHaveBeenLastCalledWith('chapter.xhtml');
    expect(prefetchMock.onChapterChange).toHaveBeenCalledWith('chapter.xhtml');
    expect(mocks.rendition.on).toHaveBeenCalledWith('relocated', expect.any(Function));

    rerender({ progressCfi: 'epubcfi(/6/6!/4)' });
    await waitFor(() => expect(mocks.rendition.display).toHaveBeenCalledWith('epubcfi(/6/6!/4)'));
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })));
    expect(mocks.rendition.next).toHaveBeenCalledOnce();
  });

  it('renders the latest annotation refs after each displayed event', () => {
    const rendition = mocks.rendition as unknown as Rendition;
    const currentChapterRef = { current: 'stale-chapter.xhtml' };
    const highlightsRef = { current: [] as HighlightRecord[] };
    const commentsRef = { current: [] as CommentRecord[] };
    const onNavigateToAnnotationRef = { current: vi.fn() as AnnotationNavigation };
    const adapterRef = { current: mocks.adapter as unknown as AnnotationAdapter };
    const latestHighlights = [{} as HighlightRecord];
    const latestComments = [{} as CommentRecord];

    const { unmount } = renderHook(() =>
      useEpubAnnotationBridge({
        rendition,
        adapterRef,
        currentChapterRef,
        highlightsRef,
        commentsRef,
        onNavigateToAnnotationRef,
      }),
    );
    highlightsRef.current = latestHighlights;
    commentsRef.current = latestComments;
    mocks.rendition.location = { start: { href: 'chapter-two.xhtml', cfi: 'epubcfi(/6/6!/4)' } };
    const displayedHandler = mocks.rendition.on.mock.calls.find(
      ([event]) => event === 'displayed',
    )?.[1];
    expect(displayedHandler).toBeTypeOf('function');

    act(() => displayedHandler?.());

    expect(currentChapterRef.current).toBe('chapter-two.xhtml');
    expect(mocks.adapter.scheduleRender).toHaveBeenCalledWith(
      'chapter-two.xhtml',
      latestHighlights,
      latestComments,
      onNavigateToAnnotationRef.current,
    );
    unmount();
    expect(mocks.rendition.off).toHaveBeenCalledWith('displayed', displayedHandler);
  });
});
