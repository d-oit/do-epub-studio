import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ReaderPage } from './ReaderPage';
import { App } from '../../App';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { useAuthStore, useReaderStore, usePreferencesStore } from '../../stores';

/**
 * Renders the reader and lets its async loaders settle inside `act()`.
 * A synchronous `act(() => render(...))` left the data-loader and file-url
 * promises resolving after the test body, which React reported as `act(...)`
 * warnings (ADR-275). The trailing `await Promise.resolve()` keeps the callback
 * genuinely async for `@typescript-eslint/require-await` *and* flushes the
 * render's microtasks inside the act scope rather than after it.
 */
async function renderReaderPage() {
  await act(async () => {
    render(
      <BrowserRouter>
        <ReaderPage />
      </BrowserRouter>,
    );
    await Promise.resolve();
  });
}

/** Clicks, then flushes the resulting state update inside `act()`. */
async function clickAndSettle(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
}

/** Renders the whole app on the reader route and awaits its async work. */
async function renderReaderApp() {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/read/test-book']}>
        <App />
      </MemoryRouter>,
    );
    await Promise.resolve();
  });
}

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn((url: string) => {
    if (url.includes('logout')) return Promise.resolve({});
    if (url.includes('bookmarks')) return Promise.resolve([]);
    if (url.includes('file-url')) return Promise.resolve({ url: 'mock-epub-url' });
    return Promise.resolve({ url: 'mock-url' });
  }),
  fetchHighlights: vi.fn(() => Promise.resolve([])),
  fetchComments: vi.fn(() => Promise.resolve([])),
  fetchProgress: vi.fn(() =>
    Promise.resolve({ locator: null, progressPercent: 0, updatedAt: null }),
  ),
}));

vi.mock('@intity/epub-js', () => ({
  default: vi.fn(),
  Rendition: vi.fn(),
}));

vi.mock('../../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
  createPerformanceMark: vi.fn(),
  measurePerformance: vi.fn(() => undefined),
  observePerformance: vi.fn(),
  reportPerformanceMetrics: vi.fn(),
}));

vi.mock('../../lib/offline', () => ({
  setupOnlineListener: vi.fn(() => vi.fn()),
  getSyncQueue: vi.fn(() => Promise.resolve([])),
  getProgress: vi.fn(() => Promise.resolve(null)),
  getAnnotations: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../lib/offline/permissions', () => ({
  setupZombieDetection: vi.fn(() => vi.fn()),
}));

describe('ReaderPage Panels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      sessionToken: 'test-token',
      bookId: 'test-book-id',
      bookSlug: 'test-book',
      isAuthenticated: true,
      capabilities: {
        canRead: true,
        canComment: true,
        canHighlight: true,
        canBookmark: false,
        canDownloadOffline: false,
        canExportNotes: false,
        canManageAccess: false,
      },
    });
    useReaderStore.setState({
      highlights: [],
      comments: [],
      bookmarks: [],
      error: null,
      isLoading: false,
    });
  });

  it('enforces panel mutual exclusivity', async () => {
    await renderReaderPage();

    await clickAndSettle(screen.getByLabelText('Contents'));
    expect(screen.getByText('Contents')).toBeInTheDocument();

    await clickAndSettle(screen.getByLabelText('Bookmarks'));

    expect(screen.queryByText('Contents')).not.toBeInTheDocument();
    expect(screen.getByText('Bookmarks')).toBeInTheDocument();
  });

  it('toggles search panel', async () => {
    await renderReaderPage();
    await clickAndSettle(screen.getByLabelText('Search'));
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('toggles settings panel', async () => {
    await renderReaderPage();
    await clickAndSettle(screen.getByLabelText('Settings'));
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('toggles comments panel', async () => {
    await renderReaderPage();
    await clickAndSettle(screen.getByLabelText('Comment'));
    expect(screen.getByText('Comments')).toBeInTheDocument();
  });

  it('displays error from store', async () => {
    useReaderStore.setState({ error: 'Access revoked' });
    await renderReaderPage();
    expect(screen.getByText('Access revoked')).toBeInTheDocument();
  });

  it('toggles info panel', async () => {
    await renderReaderPage();
    await clickAndSettle(screen.getByLabelText('About This Book'));
    expect(screen.getByText('About This Book')).toBeInTheDocument();
  });

  it('renders page content', async () => {
    await renderReaderPage();
    const root = document.querySelector('.min-h-dvh');
    expect(root).toBeInTheDocument();
  });

  it('renders with different page width classes', async () => {
    usePreferencesStore.setState({
      reader: { ...usePreferencesStore.getState().reader, pageWidth: 'narrow' },
    });
    await renderReaderPage();
    const root = document.querySelector('.min-h-dvh');
    expect(root).toBeInTheDocument();
  });

  it('restores annotations from offline cache when server fetch fails (A6)', async () => {
    const { apiRequest, fetchHighlights, fetchComments, fetchProgress } =
      await import('../../lib/api');
    const { getProgress, getAnnotations } = await import('../../lib/offline');

    // Server fetches fail
    vi.mocked(fetchHighlights).mockRejectedValueOnce(new Error('Network error'));
    vi.mocked(fetchComments).mockRejectedValueOnce(new Error('Network error'));
    vi.mocked(apiRequest).mockImplementation((url: string) => {
      if (url.includes('logout')) return Promise.resolve({});
      if (url.includes('bookmarks')) return Promise.reject(new Error('Network error'));
      if (url.includes('file-url')) return Promise.resolve({ url: 'mock-epub-url' });
      return Promise.resolve({ url: 'mock-url' });
    });
    vi.mocked(fetchProgress).mockRejectedValueOnce(new Error('Network error'));

    // Offline cache returns data
    vi.mocked(getProgress).mockResolvedValueOnce({
      id: 'prog-1',
      bookId: 'test-book-id',
      cfi: 'epubcfi(/6/14)',
      percentage: 42,
      lastRead: Date.now(),
      synced: true,
      mutationId: 'm-1',
    });
    vi.mocked(getAnnotations).mockResolvedValueOnce([
      {
        id: 'h-1',
        bookId: 'test-book-id',
        type: 'highlight',
        cfi: 'epubcfi(/6/14!/4/2)',
        text: 'saved passage',
        color: 'yellow',
        chapter: 'Ch 1',
        createdAt: Date.now(),
        synced: false,
        mutationId: 'm-h1',
      },
      {
        id: 'c-1',
        bookId: 'test-book-id',
        type: 'comment',
        cfi: 'epubcfi(/6/14!/4/3)',
        text: 'selected',
        comment: 'offline comment',
        createdAt: Date.now(),
        synced: false,
        mutationId: 'm-c1',
      },
      {
        id: 'b-1',
        bookId: 'test-book-id',
        type: 'bookmark',
        cfi: 'epubcfi(/6/14!/4/4)',
        text: 'Chapter 1',
        createdAt: Date.now(),
        synced: false,
        mutationId: 'm-b1',
      },
    ]);

    await act(async () => {
      render(
        <BrowserRouter>
          <ReaderPage />
        </BrowserRouter>,
      );
      await Promise.resolve();
    });

    // Verify offline data was restored to the store
    const storeState = useReaderStore.getState();
    expect(storeState.highlights).toHaveLength(1);
    expect(storeState.highlights[0].id).toBe('h-1');
    expect(storeState.highlights[0].selectedText).toBe('saved passage');
    expect(storeState.comments).toHaveLength(1);
    expect(storeState.comments[0].id).toBe('c-1');
    expect(storeState.comments[0].body).toBe('offline comment');
    expect(storeState.bookmarks).toHaveLength(1);
    expect(storeState.bookmarks[0].id).toBe('b-1');
    expect(storeState.bookmarks[0].label).toBe('Chapter 1');
  });
});

describe('ReaderPage theme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      sessionToken: 'test-token',
      bookId: 'test-book-id',
      bookSlug: 'test-book',
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets data-theme to light when theme is light', async () => {
    usePreferencesStore.setState({
      reader: { ...usePreferencesStore.getState().reader, theme: 'light' },
    });
    await renderReaderApp();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('sets data-theme to dark when theme is dark', async () => {
    usePreferencesStore.setState({
      reader: { ...usePreferencesStore.getState().reader, theme: 'dark' },
    });
    await renderReaderApp();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('sets data-theme to sepia when theme is sepia', async () => {
    usePreferencesStore.setState({
      reader: { ...usePreferencesStore.getState().reader, theme: 'sepia' },
    });
    await renderReaderApp();
    expect(document.documentElement).toHaveAttribute('data-theme', 'sepia');
  });

  it('resolves system theme to light when OS prefers light', async () => {
    usePreferencesStore.setState({
      reader: { ...usePreferencesStore.getState().reader, theme: 'system' },
    });
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );
    await renderReaderApp();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('resolves system theme to dark when OS prefers dark', async () => {
    usePreferencesStore.setState({
      reader: { ...usePreferencesStore.getState().reader, theme: 'system' },
    });
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );
    await renderReaderApp();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});
