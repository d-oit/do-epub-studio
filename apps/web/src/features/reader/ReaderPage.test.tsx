import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ReaderPage } from './ReaderPage';
import { BrowserRouter } from 'react-router-dom';
import { useAuthStore, useReaderStore, usePreferencesStore } from '../../stores';

// Mock dependencies
vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(() => Promise.resolve({ url: 'mock-url' })),
}));

vi.mock('../../lib/api/annotations', () => ({
  fetchHighlights: vi.fn(() => Promise.resolve([])),
  fetchComments: vi.fn(() => Promise.resolve([])),
}));

// Mock epub-js
vi.mock('@intity/epub-js', () => ({
  Rendition: vi.fn(),
}));

describe('ReaderPage Panels', () => {
  // Use non-lazy imports for testing to avoid Suspense issues
  // or wrap tests that need these in act() and wait for them.
  // Given we are testing mutual exclusivity, we need to wait for lazy components.

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

  it('enforces panel mutual exclusivity', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <ReaderPage />
        </BrowserRouter>,
      );
    });

    // Use actual labels that appear in DOM
    const tocButton = screen.getByLabelText('Contents');
    await act(async () => {
      tocButton.click();
    });

    expect(await screen.findByText('Contents')).toBeInTheDocument();

    const bookmarksButton = screen.getByLabelText('Bookmarks');
    await act(async () => {
      bookmarksButton.click();
    });

    // TOC text should disappear
    expect(screen.queryByText('Contents')).not.toBeInTheDocument();
    // Bookmarks heading should appear
    expect(await screen.findByText('Bookmarks')).toBeInTheDocument();
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

  it('sets data-theme to light when theme is light', async () => {
    usePreferencesStore.setState({ reader: { ...usePreferencesStore.getState().reader, theme: 'light' } });

    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <BrowserRouter>
          <ReaderPage />
        </BrowserRouter>,
      );
      container = result.container;
    });

    const root = container!.firstChild as HTMLElement;
    expect(root).toHaveAttribute('data-theme', 'light');
  });

  it('sets data-theme to dark when theme is dark', async () => {
    usePreferencesStore.setState({ reader: { ...usePreferencesStore.getState().reader, theme: 'dark' } });

    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <BrowserRouter>
          <ReaderPage />
        </BrowserRouter>,
      );
      container = result.container;
    });

    const root = container!.firstChild as HTMLElement;
    expect(root).toHaveAttribute('data-theme', 'dark');
  });

  it('sets data-theme to sepia when theme is sepia', async () => {
    usePreferencesStore.setState({ reader: { ...usePreferencesStore.getState().reader, theme: 'sepia' } });

    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <BrowserRouter>
          <ReaderPage />
        </BrowserRouter>,
      );
      container = result.container;
    });

    const root = container!.firstChild as HTMLElement;
    expect(root).toHaveAttribute('data-theme', 'sepia');
  });

  it('resolves system theme to light when OS prefers light', async () => {
    usePreferencesStore.setState({ reader: { ...usePreferencesStore.getState().reader, theme: 'system' } });
    (window.matchMedia as any).mockReturnValue({
      matches: false, // Not dark
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <BrowserRouter>
          <ReaderPage />
        </BrowserRouter>,
      );
      container = result.container;
    });

    const root = container!.firstChild as HTMLElement;
    expect(root).toHaveAttribute('data-theme', 'light');
  });

  it('resolves system theme to dark when OS prefers dark', async () => {
    usePreferencesStore.setState({ reader: { ...usePreferencesStore.getState().reader, theme: 'system' } });
    (window.matchMedia as any).mockReturnValue({
      matches: true, // Is dark
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <BrowserRouter>
          <ReaderPage />
        </BrowserRouter>,
      );
      container = result.container;
    });

    const root = container!.firstChild as HTMLElement;
    expect(root).toHaveAttribute('data-theme', 'dark');
  });
});
