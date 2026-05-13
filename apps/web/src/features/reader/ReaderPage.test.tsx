import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ReaderPage } from './ReaderPage';
import type { Theme } from '../../stores';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ bookSlug: 'test-book' }) };
});

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));

vi.mock('../../lib/api', () => ({ apiRequest: vi.fn().mockRejectedValue(new Error('mock')) }));
vi.mock('../../lib/api/annotations', () => ({ fetchHighlights: vi.fn().mockResolvedValue([]), fetchComments: vi.fn().mockResolvedValue([]) }));

vi.mock('../../lib/offline', () => ({
  saveProgress: vi.fn(),
  queueSync: vi.fn(),
  setupOnlineListener: vi.fn(() => vi.fn()),
  generateMutationId: vi.fn(() => 'mock-mutation-id'),
}));
vi.mock('../../lib/offline/permissions', () => ({ setupZombieDetection: vi.fn(() => vi.fn()) }));

const mockRendition = {
  themes: { default: vi.fn() },
  display: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  annotations: { each: vi.fn(() => []) },
  destroy: vi.fn(),
  location: null,
};
const mockBook = {
  ready: Promise.resolve(),
  loaded: { navigation: Promise.resolve({ toc: [] }) },
  renderTo: vi.fn(() => mockRendition),
  destroy: vi.fn(),
};
vi.mock('epubjs', () => ({ default: vi.fn(() => mockBook) }));

const mockReaderStore = {
  setProgress: vi.fn(),
  setError: vi.fn(),
  error: null,
  setOffline: vi.fn(),
  setPermissionStatus: vi.fn(),
  highlights: [],
  setHighlights: vi.fn(),
  comments: [],
  setComments: vi.fn(),
  bookmarks: [],
  setCurrentChapter: vi.fn(),
  currentChapter: null,
};

const mockPreferencesState = {
  reader: { theme: 'light' as Theme, fontSize: 'medium' as const, fontFamily: 'serif' as const, lineHeight: 2, pageWidth: 'normal' as const },
  setTheme: vi.fn(),
  setFontFamily: vi.fn(),
  setFontSize: vi.fn(),
};

const mockAuthState = {
  sessionToken: 'mock-token',
  bookId: 'mock-book-id',
  bookTitle: 'Test Book',
  capabilities: { canRead: true, canComment: true, canHighlight: true, canBookmark: true, canDownloadOffline: false, canExportNotes: false, canManageAccess: false },
  logout: vi.fn(),
};

const mockReaderUI = {
  showToc: false, setShowToc: vi.fn(),
  showSettings: false, setShowSettings: vi.fn(),
  showComments: false, setShowComments: vi.fn(),
  showBookmarks: false, setShowBookmarks: vi.fn(),
  isCommentMode: false, setIsCommentMode: vi.fn(),
  showCommentInput: false, setShowCommentInput: vi.fn(),
  selection: null, setSelection: vi.fn(),
  revokedBooks: new Set(), setRevokedBooks: vi.fn(),
};

vi.mock('../../stores', async () => {
  const actual = await vi.importActual('../../stores');
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

vi.mock('./hooks', () => ({
  useReaderUI: () => mockReaderUI,
  useAnnotationHandlers: () => ({
    handleCreateHighlight: vi.fn(), handleCreateComment: vi.fn(), handleResolveComment: vi.fn(),
    handleReplyToComment: vi.fn(), handleEditComment: vi.fn(), handleDeleteComment: vi.fn(),
    handleEditHighlight: vi.fn(), handleDeleteHighlight: vi.fn(),
  }),
  useBookmarkHandlers: () => ({ handleCreateBookmark: vi.fn(), handleDeleteBookmark: vi.fn() }),
  useExportNotes: () => ({ handleExportNotes: vi.fn() }),
}));

vi.mock('./annotationRendering', () => ({
  renderHighlightsOnRendition: vi.fn(),
  renderCommentMarkersOnRendition: vi.fn(),
}));

vi.mock('./components', () => ({
  ReaderToolbar: () => <div data-testid="reader-toolbar" />,
  ReaderSettingsPanel: () => <div data-testid="reader-settings" />,
  TableOfContents: () => <div data-testid="reader-toc" />,
  BookmarksPanel: () => <div data-testid="reader-bookmarks" />,
  ReaderViewer: () => <div data-testid="reader-viewer" />,
  CommentInputModal: () => null,
}));

vi.mock('./components/annotations', () => ({
  AnnotationToolbar: () => null,
  CommentsPanel: () => <div data-testid="comments-panel" />,
  extractSelectionData: vi.fn(() => null),
}));

function getRootTheme(): string | null {
  const toolbar = screen.getByTestId('reader-toolbar');
  const root = toolbar.closest('div[data-theme]');
  return root?.getAttribute('data-theme') ?? null;
}

describe('ReaderPage theme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('sets data-theme to light when theme is light', () => {
    mockPreferencesState.reader.theme = 'light';
    render(<ReaderPage />);
    expect(getRootTheme()).toBe('light');
  });

  it('sets data-theme to dark when theme is dark', () => {
    mockPreferencesState.reader.theme = 'dark';
    render(<ReaderPage />);
    expect(getRootTheme()).toBe('dark');
  });

  it('sets data-theme to sepia when theme is sepia', () => {
    mockPreferencesState.reader.theme = 'sepia';
    render(<ReaderPage />);
    expect(getRootTheme()).toBe('sepia');
  });

  it('resolves system theme to light when OS prefers light', () => {
    mockPreferencesState.reader.theme = 'system';
    render(<ReaderPage />);
    expect(getRootTheme()).toBe('light');
  });

  it('resolves system theme to dark when OS prefers dark', () => {
    mockPreferencesState.reader.theme = 'system';
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(<ReaderPage />);
    expect(getRootTheme()).toBe('dark');
  });
});
