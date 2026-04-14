import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentsPanel } from './CommentsPanel';
import type { Comment, Highlight } from '../../../../stores';

// Mock useTranslation hook
vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockComments: Comment[] = [
  {
    id: 'comment-1',
    body: 'First comment',
    userEmail: 'user@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'open',
    visibility: 'shared',
    parentCommentId: null,
    resolvedAt: null,
    chapterRef: 'chapter-1',
    cfiRange: 'epubcfi(/6/4!/2/2)',
    selectedText: 'Selected text for comment',
    replies: [],
  },
  {
    id: 'comment-2',
    body: 'Resolved comment',
    userEmail: 'user@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'resolved',
    visibility: 'shared',
    parentCommentId: null,
    resolvedAt: new Date().toISOString(),
    chapterRef: 'chapter-2',
    cfiRange: 'epubcfi(/6/4!/2/4)',
    selectedText: 'Resolved text',
    replies: [],
  },
];

const mockHighlights: Highlight[] = [
  {
    id: 'highlight-1',
    color: '#ffff00',
    chapterRef: 'chapter-1',
    cfiRange: 'epubcfi(/6/4!/2/2)',
    selectedText: 'Highlighted text',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    note: 'A note',
  },
  {
    id: 'highlight-2',
    color: '#90EE90',
    chapterRef: 'chapter-2',
    cfiRange: 'epubcfi(/6/4!/2/4)',
    selectedText: 'Another highlight',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    note: null,
  },
];

describe('CommentsPanel', () => {
  const mockOnClose = vi.fn();
  const mockOnResolveComment = vi.fn();
  const mockOnReplyToComment = vi.fn();
  const mockOnEditComment = vi.fn();
  const mockOnDeleteComment = vi.fn();
  const mockOnEditHighlight = vi.fn();
  const mockOnDeleteHighlight = vi.fn();
  const mockOnNavigateToAnnotation = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    comments: mockComments,
    highlights: mockHighlights,
    onResolveComment: mockOnResolveComment,
    onReplyToComment: mockOnReplyToComment,
    onEditComment: mockOnEditComment,
    onDeleteComment: mockOnDeleteComment,
    onEditHighlight: mockOnEditHighlight,
    onDeleteHighlight: mockOnDeleteHighlight,
    onNavigateToAnnotation: mockOnNavigateToAnnotation,
    currentChapter: 'chapter-1',
    locale: 'en' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('does not render when isOpen is false', () => {
      render(<CommentsPanel {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('annotation.comment')).not.toBeInTheDocument();
    });

    it('renders panel header when open', () => {
      render(<CommentsPanel {...defaultProps} />);

      // Look for the heading in the panel
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('renders close button', () => {
      render(<CommentsPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: '' })).toBeInTheDocument(); // Close button has SVG
    });

    it('renders tabs for comments and highlights', () => {
      render(<CommentsPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /annotation.comment/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /annotation.highlight/ })).toBeInTheDocument();
    });
  });

  describe('tabs', () => {
    it('shows comments tab by default', () => {
      render(<CommentsPanel {...defaultProps} />);

      // Should show open comments section
      expect(screen.getByText('Open')).toBeInTheDocument();
    });

    it('switches to highlights tab when clicked', async () => {
      const user = userEvent.setup();
      render(<CommentsPanel {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /annotation.highlight/ }));

      // Should show highlight items
      expect(screen.getByText('Highlighted text')).toBeInTheDocument();
    });

    it('shows comment count in tab', () => {
      render(<CommentsPanel {...defaultProps} />);

      // One open comment
      expect(screen.getByRole('button', { name: /annotation.comment \(1\)/ })).toBeInTheDocument();
    });

    it('shows highlight count in tab', () => {
      render(<CommentsPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /annotation.highlight \(2\)/ })).toBeInTheDocument();
    });
  });

  describe('comments tab', () => {
    it('renders open comments', () => {
      render(<CommentsPanel {...defaultProps} />);

      expect(screen.getByText('First comment')).toBeInTheDocument();
    });

    it('renders resolved comments in separate section', () => {
      render(<CommentsPanel {...defaultProps} />);

      expect(screen.getByText('Resolved')).toBeInTheDocument();
      expect(screen.getByText('Resolved comment')).toBeInTheDocument();
    });

    it('shows empty message when no comments', () => {
      render(<CommentsPanel {...defaultProps} comments={[]} />);

      expect(screen.getByText('comment.noComments')).toBeInTheDocument();
    });

    it('displays selected text as quote', () => {
      render(<CommentsPanel {...defaultProps} />);

      expect(screen.getByText(/Selected text for comment/)).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<CommentsPanel {...defaultProps} />);

      // Find the close button (SVG icon button in header)
      const closeButton = screen.getAllByRole('button')[0];
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('highlights tab', () => {
    it('renders highlights', async () => {
      const user = userEvent.setup();
      render(<CommentsPanel {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /annotation.highlight/ }));

      expect(screen.getByText('Highlighted text')).toBeInTheDocument();
      expect(screen.getByText('Another highlight')).toBeInTheDocument();
    });

    it('shows empty message when no highlights', async () => {
      const user = userEvent.setup();
      render(<CommentsPanel {...defaultProps} highlights={[]} />);

      await user.click(screen.getByRole('button', { name: /annotation.highlight/ }));

      expect(screen.getByText('highlight.noHighlights')).toBeInTheDocument();
    });

    it('shows note when present', async () => {
      const user = userEvent.setup();
      render(<CommentsPanel {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /annotation.highlight/ }));

      expect(screen.getByText('A note')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('calls onNavigateToAnnotation when clicking quoted text', async () => {
      const user = userEvent.setup();
      render(<CommentsPanel {...defaultProps} />);

      await user.click(screen.getByText(/Selected text for comment/));

      expect(mockOnNavigateToAnnotation).toHaveBeenCalledWith('chapter-1', 'epubcfi(/6/4!/2/2)');
    });

    it('calls onNavigateToAnnotation when clicking highlight', async () => {
      const user = userEvent.setup();
      render(<CommentsPanel {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /annotation.highlight/ }));
      await user.click(screen.getByText('Highlighted text'));

      expect(mockOnNavigateToAnnotation).toHaveBeenCalledWith('chapter-1', 'epubcfi(/6/4!/2/2)');
    });
  });

  describe('current chapter highlighting', () => {
    it('applies active styling to current chapter items', () => {
      render(<CommentsPanel {...defaultProps} />);

      // First comment is in current chapter
      const commentItem = screen.getByText('First comment').closest('div');
      expect(commentItem?.className).toContain('border-primary');
    });

    it('does not apply active styling to other chapter items', () => {
      render(<CommentsPanel {...defaultProps} />);

      // Resolved comment is in different chapter
      const resolvedItem = screen.getByText('Resolved comment').closest('div');
      expect(resolvedItem?.className).not.toContain('border-primary');
    });
  });
});