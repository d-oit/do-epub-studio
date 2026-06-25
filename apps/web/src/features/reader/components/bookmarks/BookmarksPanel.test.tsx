import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookmarksPanel } from './BookmarksPanel';
import type { Bookmark } from '../../../../stores';

vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockBookmarks: Bookmark[] = [
  { id: 'bm-1', label: 'Chapter 1 Start', locator: { cfi: 'epubcfi(/6/2)' }, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'bm-2', label: null, locator: { cfi: 'epubcfi(/6/4)' }, createdAt: '2026-01-02T00:00:00Z' },
];

describe('BookmarksPanel', () => {
  const defaultProps = {
    isOpen: true,
    bookmarks: mockBookmarks,
    onClose: vi.fn(),
    onAddBookmark: vi.fn(),
    onDeleteBookmark: vi.fn(),
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<BookmarksPanel {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when open', () => {
    render(<BookmarksPanel {...defaultProps} />);
    expect(screen.getByText('Bookmarks')).toBeInTheDocument();
  });

  it('renders bookmark labels', () => {
    render(<BookmarksPanel {...defaultProps} />);
    expect(screen.getByText('Chapter 1 Start')).toBeInTheDocument();
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('calls onNavigate when bookmark clicked', () => {
    render(<BookmarksPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Chapter 1 Start'));
    expect(defaultProps.onNavigate).toHaveBeenCalledWith(mockBookmarks[0]);
  });

  it('calls onAddBookmark when add button clicked', () => {
    render(<BookmarksPanel {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('a11y.add_bookmark'));
    expect(defaultProps.onAddBookmark).toHaveBeenCalled();
  });

  it('calls onDeleteBookmark when delete clicked', () => {
    render(<BookmarksPanel {...defaultProps} />);
    const deleteButtons = screen.getAllByLabelText('a11y.delete_bookmark');
    fireEvent.click(deleteButtons[0]);
    expect(defaultProps.onDeleteBookmark).toHaveBeenCalledWith('bm-1');
  });

  it('calls onClose when close button clicked', () => {
    render(<BookmarksPanel {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(b => b.querySelector('svg path[d*="18L18 6"]'));
    if (closeButton) fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows empty message when no bookmarks', () => {
    render(<BookmarksPanel {...defaultProps} bookmarks={[]} />);
    expect(screen.getByText(/No bookmarks yet/)).toBeInTheDocument();
  });

  it('calls onClose on Escape key', () => {
    render(<BookmarksPanel {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders dates', () => {
    render(<BookmarksPanel {...defaultProps} />);
    expect(screen.getByText('1/1/2026')).toBeInTheDocument();
  });

  it('marks the panel as a named inline-size container (ADR-105)', () => {
    const { container } = render(<BookmarksPanel {...defaultProps} />);
    const panel = container.querySelector('[data-container-name="bookmarks-panel"]');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass('cq');
    expect(panel).toHaveClass('cq--bookmarks-panel');
  });

  it('applies cq-bookmark-row class so container queries can stack items horizontally', () => {
    const { container } = render(<BookmarksPanel {...defaultProps} />);
    const rows = container.querySelectorAll('.cq-bookmark-row');
    expect(rows).toHaveLength(mockBookmarks.length);
  });
});
