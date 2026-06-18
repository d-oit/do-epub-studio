import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ReaderPage } from './ReaderPage';
import { App } from '../../App';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { useAuthStore, useReaderStore, usePreferencesStore } from '../../stores';

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn((url: string) => {
    if (url.includes('logout')) return Promise.resolve({});
    if (url.includes('bookmarks')) return Promise.resolve([]);
    if (url.includes('file-url')) return Promise.resolve({ url: 'mock-epub-url' });
    return Promise.resolve({ url: 'mock-url' });
  }),
  fetchHighlights: vi.fn(() => Promise.resolve([])),
  fetchComments: vi.fn(() => Promise.resolve([])),
  fetchProgress: vi.fn(() => Promise.resolve({ locator: null, progressPercent: 0, updatedAt: null })),
}));

vi.mock('@intity/epub-js', () => ({
  default: vi.fn(),
  Rendition: vi.fn(),
}));

vi.mock('../../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
}));

vi.mock('../../lib/offline', () => ({
  setupOnlineListener: vi.fn(() => vi.fn()),
  getSyncQueue: vi.fn(() => Promise.resolve([])),
  getProgress: vi.fn(() => Promise.resolve(null)),
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
      capabilities: { canRead: true, canComment: true, canHighlight: true } as any,
    });
    useReaderStore.setState({
      highlights: [],
      comments: [],
      bookmarks: [],
      error: null,
      isLoading: false,
    });
  });

  it('enforces panel mutual exclusivity', () => {
    act(() => {
      render(
        <BrowserRouter>
          <ReaderPage />
        </BrowserRouter>,
      );
    });

    const tocButton = screen.getByLabelText('Contents');
    act(() => { tocButton.click(); });
    expect(screen.getByText('Contents')).toBeInTheDocument();

    const bookmarksButton = screen.getByLabelText('Bookmarks');
    act(() => { bookmarksButton.click(); });

    expect(screen.queryByText('Contents')).not.toBeInTheDocument();
    expect(screen.getByText('Bookmarks')).toBeInTheDocument();
  });

  it('toggles search panel', () => {
    act(() => {
      render(<BrowserRouter><ReaderPage /></BrowserRouter>);
    });
    const searchButton = screen.getByLabelText('Search');
    act(() => { searchButton.click(); });
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('toggles settings panel', () => {
    act(() => {
      render(<BrowserRouter><ReaderPage /></BrowserRouter>);
    });
    const settingsButton = screen.getByLabelText('Settings');
    act(() => { settingsButton.click(); });
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('toggles comments panel', () => {
    act(() => {
      render(<BrowserRouter><ReaderPage /></BrowserRouter>);
    });
    const commentsButton = screen.getByLabelText('Comment');
    act(() => { commentsButton.click(); });
    expect(screen.getByText('Comments')).toBeInTheDocument();
  });

  it('displays error from store', () => {
    useReaderStore.setState({ error: 'Access revoked' });
    act(() => {
      render(<BrowserRouter><ReaderPage /></BrowserRouter>);
    });
    expect(screen.getByText('Access revoked')).toBeInTheDocument();
  });

  it('toggles info panel', () => {
    act(() => {
      render(<BrowserRouter><ReaderPage /></BrowserRouter>);
    });
    const infoButton = screen.getByLabelText('About This Book');
    act(() => { infoButton.click(); });
    expect(screen.getByText('About This Book')).toBeInTheDocument();
  });

  it('renders page content', () => {
    act(() => {
      render(<BrowserRouter><ReaderPage /></BrowserRouter>);
    });
    const root = document.querySelector('.min-h-screen');
    expect(root).toBeInTheDocument();
  });

  it('renders with different page width classes', () => {
    usePreferencesStore.setState({
      reader: { ...usePreferencesStore.getState().reader, pageWidth: 'narrow' },
    });
    act(() => {
      render(<BrowserRouter><ReaderPage /></BrowserRouter>);
    });
    const root = document.querySelector('.min-h-screen');
    expect(root).toBeInTheDocument();
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

  it('sets data-theme to light when theme is light', () => {
    usePreferencesStore.setState({ reader: { ...usePreferencesStore.getState().reader, theme: 'light' } });
    render(
      <MemoryRouter initialEntries={['/read/test-book']}>
        <App />
      </MemoryRouter>,
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('sets data-theme to dark when theme is dark', () => {
    usePreferencesStore.setState({ reader: { ...usePreferencesStore.getState().reader, theme: 'dark' } });
    render(
      <MemoryRouter initialEntries={['/read/test-book']}>
        <App />
      </MemoryRouter>,
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('sets data-theme to sepia when theme is sepia', () => {
    usePreferencesStore.setState({ reader: { ...usePreferencesStore.getState().reader, theme: 'sepia' } });
    render(
      <MemoryRouter initialEntries={['/read/test-book']}>
        <App />
      </MemoryRouter>,
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'sepia');
  });

  it('resolves system theme to light when OS prefers light', () => {
    usePreferencesStore.setState({ reader: { ...usePreferencesStore.getState().reader, theme: 'system' } });
    (window.matchMedia as any).mockReturnValue({
      matches: false, media: '', onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/read/test-book']}>
        <App />
      </MemoryRouter>,
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('resolves system theme to dark when OS prefers dark', () => {
    usePreferencesStore.setState({ reader: { ...usePreferencesStore.getState().reader, theme: 'system' } });
    (window.matchMedia as any).mockReturnValue({
      matches: true, media: '', onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/read/test-book']}>
        <App />
      </MemoryRouter>,
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});
