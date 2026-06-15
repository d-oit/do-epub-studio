import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ReaderPage } from './ReaderPage';
import { App } from '../../App';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { useAuthStore, useReaderStore, usePreferencesStore } from '../../stores';

// Mock dependencies
vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn((url: string) =>
    Promise.resolve(url.includes('bookmarks') ? [] : { url: 'mock-url' }),
  ),
  fetchHighlights: vi.fn(() => Promise.resolve([])),
  fetchComments: vi.fn(() => Promise.resolve([])),
  fetchProgress: vi.fn(() => Promise.resolve({ locator: null, progressPercent: 0, updatedAt: null })),
}));

// Mock epub-js
vi.mock('@intity/epub-js', () => ({
  Rendition: vi.fn(),
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

    // Use actual labels that appear in DOM
    const tocButton = screen.getByLabelText('Contents');
    act(() => {
      tocButton.click();
    });

    expect(screen.getByText('Contents')).toBeInTheDocument();

    const bookmarksButton = screen.getByLabelText('Bookmarks');
    act(() => {
      bookmarksButton.click();
    });

    // TOC text should disappear
    expect(screen.queryByText('Contents')).not.toBeInTheDocument();
    // Bookmarks heading should appear
    expect(screen.getByText('Bookmarks')).toBeInTheDocument();
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
      matches: false, // Not dark
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
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
      matches: true, // Is dark
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/read/test-book']}>
        <App />
      </MemoryRouter>,
    );

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});
