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
});
