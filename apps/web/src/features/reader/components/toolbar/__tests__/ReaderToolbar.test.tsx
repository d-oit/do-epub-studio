import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReaderToolbar } from '../ReaderToolbar';

vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

vi.mock('../../../../components/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

describe('ReaderToolbar', () => {
  const mockT = (key: string) => key;
  const defaultProps = {
    bookTitle: 'Test Book',
    bookSlug: 'test-book',
    comments: [],
    bookmarks: [],
    capabilities: { canComment: true },
    onToggleToc: vi.fn(),
    onToggleComments: vi.fn(),
    onToggleBookmarks: vi.fn(),
    onToggleSettings: vi.fn(),
    onExportNotes: vi.fn(),
    onLogout: vi.fn(),
    t: mockT,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders book title', () => {
    render(<ReaderToolbar {...defaultProps} />);
    expect(screen.getByText('Test Book')).toBeInTheDocument();
  });

  it('renders fallback title when title is missing', () => {
    render(<ReaderToolbar {...defaultProps} bookTitle={null} />);
    expect(screen.getByText('reader.untitledBook')).toBeInTheDocument();
  });

  it('calls onToggleToc when TOC button is clicked', () => {
    render(<ReaderToolbar {...defaultProps} />);
    const tocButton = screen.getByLabelText('reader.tableOfContents');
    fireEvent.click(tocButton);
    expect(defaultProps.onToggleToc).toHaveBeenCalled();
  });

  it('opens mobile menu when "More options" is clicked', () => {
    render(<ReaderToolbar {...defaultProps} />);
    const moreButton = screen.getByLabelText('More options');
    fireEvent.click(moreButton);
    expect(screen.getByText('reader.exportNotes')).toBeInTheDocument();
  });
});
