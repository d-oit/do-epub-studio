import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ReaderToolbar } from './ReaderToolbar';
import { useReaderStore } from '../../../../stores/reader';

// Mock translation
vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const parts = key.split('.');
      return parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1);
    },
  }),
}));

// Mock scroll direction hook
const mockUseScrollDirection = vi.fn(() => 'up');
vi.mock('../../../../hooks/useScrollDirection', () => ({
  useScrollDirection: () => mockUseScrollDirection(),
}));

describe('ReaderToolbar', () => {
  const mockProps = {
    bookTitle: 'Test Book',
    bookSlug: 'test-book',
    comments: [],
    bookmarks: [],
    capabilities: { canComment: true },
    activePanel: null,
    onToggleToc: vi.fn(),
    onToggleSearch: vi.fn(),
    onToggleComments: vi.fn(),
    onToggleBookmarks: vi.fn(),
    onToggleSettings: vi.fn(),
    onToggleInfo: vi.fn(),
    onExportNotes: vi.fn(),
    onLogout: vi.fn(),
    t: (key: string) => {
       if (key === 'reader.tableOfContents') return 'Contents';
       if (key === 'reader.search') return 'Search';
       if (key === 'reader.untitledBook') return 'Untitled Book';
       if (key === 'annotation.comment') return 'Comment';
       if (key === 'reader.bookmarks') return 'Bookmarks';
       if (key === 'reader.aboutBook') return 'About This Book';
       if (key === 'reader.exportNotes') return 'Export Notes';
       if (key === 'reader.settings') return 'Settings';
       if (key === 'reader.signOut') return 'Sign Out';
       if (key === 'offline.indicator') return 'Offline';
       if (key === 'a11y.reading_progress') return 'Reading Progress';
       return key;
     },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useReaderStore.setState({
      progress: { locator: null, progressPercent: 45, updatedAt: null }
    });
  });

  it('renders book title and progress', () => {
    render(<ReaderToolbar {...mockProps} />);
    expect(screen.getByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('calls toggle handlers when buttons are clicked', () => {
    render(<ReaderToolbar {...mockProps} />);

    const tocButton = screen.getByLabelText('Contents');
    tocButton.click();
    expect(mockProps.onToggleToc).toHaveBeenCalled();
  });

  it('verifies reading progress indicator updates', () => {
    render(<ReaderToolbar {...mockProps} />);
    expect(screen.getByText('45%')).toBeInTheDocument();

    act(() => {
      useReaderStore.setState({
        progress: { locator: null, progressPercent: 80, updatedAt: null }
      });
    });

    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('hides header when scrolling down', () => {
    mockUseScrollDirection.mockReturnValue('down');
    render(<ReaderToolbar {...mockProps} />);

    // When hidden, aria-hidden="true" is applied, so we need to use hidden: true
    const header = screen.getByRole('banner', { hidden: true });
    expect(header).toHaveAttribute('data-animate');
    expect(header.getAttribute('data-animate')).toContain('var(--motion-header-offset)');
  });

  it('renders untitled book when bookTitle is null', () => {
    render(<ReaderToolbar {...mockProps} bookTitle={null} />);
    expect(screen.getByText('Untitled Book')).toBeInTheDocument();
  });

  it('shows search button', () => {
    render(<ReaderToolbar {...mockProps} />);
    const searchButton = screen.getByLabelText('Search');
    searchButton.click();
    expect(mockProps.onToggleSearch).toHaveBeenCalled();
  });

  it('shows comments button when canComment is true', () => {
    render(<ReaderToolbar {...mockProps} />);
    const commentsButton = screen.getByLabelText('Comment');
    commentsButton.click();
    expect(mockProps.onToggleComments).toHaveBeenCalled();
  });

  it('hides comments button when canComment is false', () => {
    render(<ReaderToolbar {...mockProps} capabilities={{ canComment: false }} />);
    expect(screen.queryByLabelText('Comment')).not.toBeInTheDocument();
  });

  it('shows bookmarks button', () => {
    render(<ReaderToolbar {...mockProps} />);
    const bookmarksButton = screen.getByLabelText('Bookmarks');
    bookmarksButton.click();
    expect(mockProps.onToggleBookmarks).toHaveBeenCalled();
  });

  it('shows info button', () => {
    render(<ReaderToolbar {...mockProps} />);
    const infoButton = screen.getByLabelText('About This Book');
    infoButton.click();
    expect(mockProps.onToggleInfo).toHaveBeenCalled();
  });

  it('shows export notes button', () => {
    render(<ReaderToolbar {...mockProps} />);
    const exportButton = screen.getByLabelText('Export Notes');
    exportButton.click();
    expect(mockProps.onExportNotes).toHaveBeenCalled();
  });

  it('shows settings button', () => {
    render(<ReaderToolbar {...mockProps} />);
    const settingsButton = screen.getByLabelText('Settings');
    settingsButton.click();
    expect(mockProps.onToggleSettings).toHaveBeenCalled();
  });

  it('shows sign out button', () => {
    render(<ReaderToolbar {...mockProps} />);
    const signOutButton = screen.getByText('Sign Out');
    signOutButton.click();
    expect(mockProps.onLogout).toHaveBeenCalled();
  });

  it('shows open comments count', () => {
    const comments = [
      { id: '1', status: 'open' as const, body: 'Comment 1', userEmail: 'a@b.com', chapterRef: null, cfiRange: null, selectedText: null, visibility: 'shared' as const, parentCommentId: null, createdAt: '', updatedAt: '', resolvedAt: null },
      { id: '2', status: 'resolved' as const, body: 'Comment 2', userEmail: 'a@b.com', chapterRef: null, cfiRange: null, selectedText: null, visibility: 'shared' as const, parentCommentId: null, createdAt: '', updatedAt: '', resolvedAt: null },
    ];
    render(<ReaderToolbar {...mockProps} comments={comments} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows bookmarks count', () => {
    const bookmarks = [
      { id: '1', locator: { cfi: 'cfi' }, label: null, createdAt: '' },
      { id: '2', locator: { cfi: 'cfi2' }, label: null, createdAt: '' },
    ];
    render(<ReaderToolbar {...mockProps} bookmarks={bookmarks} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows offline indicator when offline', () => {
    useReaderStore.setState({ isOffline: true });
    render(<ReaderToolbar {...mockProps} />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('shows pending sync count when offline', () => {
    useReaderStore.setState({ isOffline: true, pendingSyncCount: 3 });
    render(<ReaderToolbar {...mockProps} />);
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  it('calls all toggle handlers', () => {
    render(<ReaderToolbar {...mockProps} />);

    screen.getByLabelText('Contents').click();
    expect(mockProps.onToggleToc).toHaveBeenCalled();

    screen.getByLabelText('Search').click();
    expect(mockProps.onToggleSearch).toHaveBeenCalled();

    screen.getByLabelText('Comment').click();
    expect(mockProps.onToggleComments).toHaveBeenCalled();

    screen.getByLabelText('Bookmarks').click();
    expect(mockProps.onToggleBookmarks).toHaveBeenCalled();

    screen.getByLabelText('About This Book').click();
    expect(mockProps.onToggleInfo).toHaveBeenCalled();

    screen.getByLabelText('Export Notes').click();
    expect(mockProps.onExportNotes).toHaveBeenCalled();

    screen.getByLabelText('Settings').click();
    expect(mockProps.onToggleSettings).toHaveBeenCalled();

    screen.getByText('Sign Out').click();
    expect(mockProps.onLogout).toHaveBeenCalled();
  });
});
