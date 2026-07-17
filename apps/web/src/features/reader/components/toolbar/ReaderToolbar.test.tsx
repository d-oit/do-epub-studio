import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ReaderToolbar } from './ReaderToolbar';
import { useReaderStore } from '../../../../stores/reader';

// Mock translation
vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'reader.tableOfContents': 'Contents',
        'reader.search': 'Search',
        'reader.untitledBook': 'Untitled Book',
        'annotation.comment': 'Comment',
        'reader.bookmarks': 'Bookmarks',
        'reader.aboutBook': 'About This Book',
        'reader.exportNotes': 'Export Notes',
        'reader.settings': 'Settings',
        'reader.signOut': 'Sign Out',
        'reader.moreOptions': 'More Options',
        'offline.indicator': 'Offline',
        'a11y.reading_progress': 'Reading Progress',
      };
      return translations[key] || key;
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
    toc: [{ label: 'Chapter 1', href: 'ch1.xhtml' }, { label: 'Chapter 2', href: 'ch2.xhtml' }],
    currentChapter: 'ch1.xhtml',
    onToggleToc: vi.fn(),
    onToggleSearch: vi.fn(),
    onToggleComments: vi.fn(),
    onToggleBookmarks: vi.fn(),
    onToggleSettings: vi.fn(),
    onToggleInfo: vi.fn(),
    onExportNotes: vi.fn(),
    onLogout: vi.fn(),
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        'reader.tableOfContents': 'Contents',
        'reader.search': 'Search',
        'reader.untitledBook': 'Untitled Book',
        'reader.chapterProgress': `Chapter ${params?.current} of ${params?.total}`,
        'annotation.comment': 'Comment',
        'reader.bookmarks': 'Bookmarks',
        'reader.aboutBook': 'About This Book',
        'reader.exportNotes': 'Export Notes',
        'reader.settings': 'Settings',
        'reader.signOut': 'Sign Out',
        'reader.moreOptions': 'More Options',
        'offline.indicator': 'Offline',
        'a11y.reading_progress': 'Reading Progress',
      };
      return translations[key] || key;
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useReaderStore.setState({
      progress: { locator: null, progressPercent: 45, updatedAt: null },
      isOffline: false,
      pendingSyncCount: 0,
    });
  });

  it('renders book title and progress', () => {
    render(<ReaderToolbar {...mockProps} />);
    expect(screen.getByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('renders chapter progress indicator', () => {
    render(<ReaderToolbar {...mockProps} />);
    expect(screen.getByText('Chapter 1 of 2')).toBeInTheDocument();
  });

  it('hides chapter progress when toc is empty', () => {
    render(<ReaderToolbar {...mockProps} toc={[]} />);
    expect(screen.queryByText(/Chapter/)).not.toBeInTheDocument();
  });

  it('hides chapter progress when currentChapter is null', () => {
    render(<ReaderToolbar {...mockProps} currentChapter={null} />);
    expect(screen.queryByText(/Chapter/)).not.toBeInTheDocument();
  });

  it('calls toggle handlers when buttons are clicked', () => {
    render(<ReaderToolbar {...mockProps} />);
    screen.getByLabelText('Contents').click();
    expect(mockProps.onToggleToc).toHaveBeenCalled();
  });

  it('verifies reading progress indicator updates', () => {
    render(<ReaderToolbar {...mockProps} />);
    expect(screen.getByText('45%')).toBeInTheDocument();

    act(() => {
      useReaderStore.setState({
        progress: { locator: null, progressPercent: 80, updatedAt: null },
      });
    });

    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('hides header when scrolling down', () => {
    mockUseScrollDirection.mockReturnValue('down');
    render(<ReaderToolbar {...mockProps} />);
    const header = screen.getByRole('banner', { hidden: true });
    expect(header.className).toContain('-translate-y-full');
    expect(header.className).toContain('pointer-events-none');
  });

  it('shows header when scrolling up', () => {
    mockUseScrollDirection.mockReturnValue('up');
    render(<ReaderToolbar {...mockProps} />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
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

  it('hides offline indicator when online', () => {
    useReaderStore.setState({ isOffline: false });
    render(<ReaderToolbar {...mockProps} />);
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  });

  it('toggles mobile menu open', () => {
    render(<ReaderToolbar {...mockProps} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('closes mobile menu when clicking menu item', () => {
    render(<ReaderToolbar {...mockProps} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    expect(screen.getByText('Search')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Search').closest('button') as HTMLElement);
    expect(screen.queryByText('Search')).not.toBeInTheDocument();
  });

  it('closes mobile menu when clicking outside', () => {
    render(<ReaderToolbar {...mockProps} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    expect(screen.getByText('Search')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Search')).not.toBeInTheDocument();
  });

  it('closes mobile menu on escape key', () => {
    render(<ReaderToolbar {...mockProps} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    expect(screen.getByText('Search')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Search')).not.toBeInTheDocument();
  });

  it('shows capabilities null case', () => {
    render(<ReaderToolbar {...mockProps} capabilities={null} />);
    expect(screen.queryByLabelText('Comment')).not.toBeInTheDocument();
  });

  it('shows active panel indicator for toc', () => {
    render(<ReaderToolbar {...mockProps} activePanel="toc" />);
    const tocButton = screen.getByLabelText('Contents');
    expect(tocButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows active panel indicator for search', () => {
    render(<ReaderToolbar {...mockProps} activePanel="search" />);
    const searchButton = screen.getByLabelText('Search');
    expect(searchButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows active panel indicator for comments', () => {
    render(<ReaderToolbar {...mockProps} activePanel="comments" />);
    const commentsButton = screen.getByLabelText('Comment');
    expect(commentsButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows active panel indicator for bookmarks', () => {
    render(<ReaderToolbar {...mockProps} activePanel="bookmarks" />);
    const bookmarksButton = screen.getByLabelText('Bookmarks');
    expect(bookmarksButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows active panel indicator for info', () => {
    render(<ReaderToolbar {...mockProps} activePanel="info" />);
    const infoButton = screen.getByLabelText('About This Book');
    expect(infoButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows active panel indicator for settings', () => {
    render(<ReaderToolbar {...mockProps} activePanel="settings" />);
    const settingsButton = screen.getByLabelText('Settings');
    expect(settingsButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders progress bar with correct width', () => {
    render(<ReaderToolbar {...mockProps} />);
    const progressBars = screen.getAllByRole('progressbar');
    const progressBar = progressBars[progressBars.length - 1];
    expect(progressBar).toHaveStyle({ width: '45%' });
  });

  it('renders progress bar with aria attributes', () => {
    render(<ReaderToolbar {...mockProps} />);
    const progressBars = screen.getAllByRole('progressbar');
    const progressBar = progressBars[progressBars.length - 1];
    expect(progressBar).toHaveAttribute('aria-valuenow', '45');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('shows zero comments count', () => {
    render(<ReaderToolbar {...mockProps} comments={[]} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows zero bookmarks count', () => {
    render(<ReaderToolbar {...mockProps} bookmarks={[]} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('handles capabilities with canComment undefined', () => {
    render(<ReaderToolbar {...mockProps} capabilities={{}} />);
    expect(screen.queryByLabelText('Comment')).not.toBeInTheDocument();
  });

  it('renders all desktop buttons', () => {
    render(<ReaderToolbar {...mockProps} />);
    expect(screen.getByLabelText('Contents')).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByLabelText('Bookmarks')).toBeInTheDocument();
    expect(screen.getByLabelText('About This Book')).toBeInTheDocument();
    expect(screen.getByLabelText('Export Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });

  it('shows settings in mobile menu', () => {
    render(<ReaderToolbar {...mockProps} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    const settingsButtons = screen.getAllByText('Settings');
    expect(settingsButtons.length).toBeGreaterThan(0);
  });

  it('clicks comments in mobile menu', () => {
    render(<ReaderToolbar {...mockProps} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    const commentBtn = screen.getByText('Comment').closest('button') as HTMLElement;
    fireEvent.click(commentBtn);
    expect(mockProps.onToggleComments).toHaveBeenCalled();
  });

  it('clicks bookmarks in mobile menu', () => {
    render(<ReaderToolbar {...mockProps} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    const bookmarkBtn = screen.getByText('Bookmarks').closest('button') as HTMLElement;
    fireEvent.click(bookmarkBtn);
    expect(mockProps.onToggleBookmarks).toHaveBeenCalled();
  });

  it('clicks info in mobile menu', () => {
    render(<ReaderToolbar {...mockProps} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    const infoBtn = screen.getByText('About This Book').closest('button') as HTMLElement;
    fireEvent.click(infoBtn);
    expect(mockProps.onToggleInfo).toHaveBeenCalled();
  });

  it('clicks export notes in mobile menu', () => {
    render(<ReaderToolbar {...mockProps} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    const exportBtn = screen.getByText('Export Notes').closest('button') as HTMLElement;
    fireEvent.click(exportBtn);
    expect(mockProps.onExportNotes).toHaveBeenCalled();
  });

  it('clicks settings in mobile menu', () => {
    render(<ReaderToolbar {...mockProps} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    const settingsBtns = screen.getAllByText('Settings');
    fireEvent.click(settingsBtns[settingsBtns.length - 1].closest('button') as HTMLElement);
    expect(mockProps.onToggleSettings).toHaveBeenCalled();
  });

  it('clicks sign out in mobile menu', () => {
    render(<ReaderToolbar {...mockProps} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    const signOutBtns = screen.getAllByText('Sign Out');
    fireEvent.click(signOutBtns[signOutBtns.length - 1]);
    expect(mockProps.onLogout).toHaveBeenCalled();
  });

  it('shows comments count in mobile menu', () => {
    const comments = [
      { id: '1', status: 'open' as const, body: 'Comment 1', userEmail: 'a@b.com', chapterRef: null, cfiRange: null, selectedText: null, visibility: 'shared' as const, parentCommentId: null, createdAt: '', updatedAt: '', resolvedAt: null },
    ];
    render(<ReaderToolbar {...mockProps} comments={comments} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    const badges = screen.getAllByText('1');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows bookmarks count in mobile menu', () => {
    const bookmarks = [
      { id: '1', locator: { cfi: 'cfi' }, label: null, createdAt: '' },
    ];
    render(<ReaderToolbar {...mockProps} bookmarks={bookmarks} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    const badges = screen.getAllByText('1');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders menu dividers in mobile menu', () => {
    render(<ReaderToolbar {...mockProps} />);
    const menuButton = screen.getByLabelText('More Options');
    fireEvent.click(menuButton);
    expect(screen.getAllByText('Search').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sign Out').length).toBeGreaterThanOrEqual(1);
  });
});
