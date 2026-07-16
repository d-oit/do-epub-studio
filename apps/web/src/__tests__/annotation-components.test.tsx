import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommentItem } from '../features/reader/components/annotations/CommentItem';
import { HighlightItem } from '../features/reader/components/annotations/HighlightItem';
import { formatDate } from '../features/reader/components/annotations/formatDate';

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockT = (key: string) => key;

describe('formatDate', () => {
  it('returns just now for recent dates', () => {
    const now = new Date().toISOString();
    expect(formatDate(now)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const date = new Date(Date.now() - 5 * 60000).toISOString();
    expect(formatDate(date)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const date = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(formatDate(date)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const date = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(formatDate(date)).toBe('2d ago');
  });

  it('returns locale date for old dates', () => {
    const date = new Date(Date.now() - 30 * 86400000).toISOString();
    const result = formatDate(date);
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it('uses i18n t() when provided for just now', () => {
    const mockT = vi.fn((key: string, _params?: Record<string, string | number>) => {
      if (key === 'relativeTime.justNow') return 'jetzt';
      if (key === 'relativeTime.minutesAgo') return `vor ${String(_params?.count ?? '')}Min`;
      return key;
    });
    const now = new Date().toISOString();
    expect(formatDate(now, mockT)).toBe('jetzt');
    expect(mockT).toHaveBeenCalledWith('relativeTime.justNow');
  });

  it('uses i18n t() when provided for minutes ago', () => {
    const mockT = vi.fn((key: string, params?: Record<string, string | number>) => {
      if (key === 'relativeTime.minutesAgo') return `vor ${String(params?.count ?? '')}Min`;
      return key;
    });
    const date = new Date(Date.now() - 5 * 60000).toISOString();
    const result = formatDate(date, mockT);
    expect(result).toBe('vor 5Min');
    expect(mockT).toHaveBeenCalledWith('relativeTime.minutesAgo', { count: 5 });
  });

  it('uses i18n t() when provided for hours ago', () => {
    const mockT = vi.fn((key: string, params?: Record<string, string | number>) => {
      if (key === 'relativeTime.hoursAgo') return `il y a ${String(params?.count ?? '')}h`;
      return key;
    });
    const date = new Date(Date.now() - 3 * 3600000).toISOString();
    const result = formatDate(date, mockT);
    expect(result).toBe('il y a 3h');
    expect(mockT).toHaveBeenCalledWith('relativeTime.hoursAgo', { count: 3 });
  });

  it('uses i18n t() when provided for days ago', () => {
    const mockT = vi.fn((key: string, params?: Record<string, string | number>) => {
      if (key === 'relativeTime.daysAgo') return `${String(params?.count ?? '')}日前`;
      return key;
    });
    const date = new Date(Date.now() - 2 * 86400000).toISOString();
    const result = formatDate(date, mockT);
    expect(result).toBe('2日前');
    expect(mockT).toHaveBeenCalledWith('relativeTime.daysAgo', { count: 2 });
  });

  it('falls back to English when t is not provided', () => {
    const date = new Date(Date.now() - 10 * 60000).toISOString();
    expect(formatDate(date)).toBe('10m ago');
  });
});

describe('CommentItem', () => {
  const baseProps = {
    comment: {
      id: 'c1',
      body: 'Test comment',
      userEmail: 'test@example.com',
      status: 'open' as const,
      visibility: 'shared' as const,
      selectedText: 'selected text',
      chapterRef: 'ch1',
      cfiRange: 'cfi',
      parentCommentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolvedAt: null,
    },
    isCurrentChapter: true,
    replyingTo: null,
    replyText: '',
    setReplyingTo: vi.fn(),
    setReplyText: vi.fn(),
    handleReply: vi.fn(),
    editingComment: null,
    editText: '',
    setEditingComment: vi.fn(),
    setEditText: vi.fn(),
    handleEdit: vi.fn(),
    onResolve: vi.fn(),
    onDelete: vi.fn(),
    onNavigate: vi.fn(),
    t: mockT,
  };

  it('renders comment body', () => {
    render(<CommentItem {...baseProps} />);
    expect(screen.getByText('Test comment')).toBeInTheDocument();
  });

  it('renders user email', () => {
    render(<CommentItem {...baseProps} />);
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  it('renders selected text when present', () => {
    render(<CommentItem {...baseProps} />);
    expect(screen.getByText(/selected text/)).toBeInTheDocument();
  });

  it('calls onNavigate when clicking selected text', () => {
    render(<CommentItem {...baseProps} />);
    fireEvent.click(screen.getByText(/selected text/));
    expect(baseProps.onNavigate).toHaveBeenCalled();
  });

  it('shows resolved status when resolved', () => {
    const props = {
      ...baseProps,
      comment: { ...baseProps.comment, status: 'resolved' as const },
    };
    render(<CommentItem {...props} />);
    expect(screen.getByText('comment.resolved')).toBeInTheDocument();
  });

  it('shows action buttons on hover', () => {
    render(<CommentItem {...baseProps} />);
    const container = screen.getByText('Test comment').parentElement;
    if (container) {
      fireEvent.mouseEnter(container);
    }
    expect(screen.getByText('comment.reply')).toBeInTheDocument();
    expect(screen.getByText('comment.edit')).toBeInTheDocument();
    expect(screen.getByText('comment.resolve')).toBeInTheDocument();
    expect(screen.getByText('comment.delete')).toBeInTheDocument();
  });

  it('calls setReplyingTo when clicking reply', () => {
    render(<CommentItem {...baseProps} />);
    const container = screen.getByText('Test comment').parentElement;
    if (container) {
      fireEvent.mouseEnter(container);
    }
    fireEvent.click(screen.getByText('comment.reply'));
    expect(baseProps.setReplyingTo).toHaveBeenCalledWith('c1');
  });

  it('calls setEditingComment when clicking edit', () => {
    render(<CommentItem {...baseProps} />);
    const container = screen.getByText('Test comment').parentElement;
    if (container) {
      fireEvent.mouseEnter(container);
    }
    fireEvent.click(screen.getByText('comment.edit'));
    expect(baseProps.setEditingComment).toHaveBeenCalledWith('c1');
    expect(baseProps.setEditText).toHaveBeenCalledWith('Test comment');
  });

  it('calls onResolve when clicking resolve', () => {
    render(<CommentItem {...baseProps} />);
    const container = screen.getByText('Test comment').parentElement;
    if (container) {
      fireEvent.mouseEnter(container);
    }
    fireEvent.click(screen.getByText('comment.resolve'));
    expect(baseProps.onResolve).toHaveBeenCalledWith('c1');
  });

  it('calls onDelete when clicking delete', () => {
    render(<CommentItem {...baseProps} />);
    const container = screen.getByText('Test comment').parentElement;
    if (container) {
      fireEvent.mouseEnter(container);
    }
    fireEvent.click(screen.getByText('comment.delete'));
    expect(baseProps.onDelete).toHaveBeenCalledWith('c1');
  });

  it('shows edit mode when editing', () => {
    const props = {
      ...baseProps,
      editingComment: 'c1',
      editText: 'Edited text',
    };
    render(<CommentItem {...props} />);
    expect(screen.getByDisplayValue('Edited text')).toBeInTheDocument();
    expect(screen.getByText('annotation.save')).toBeInTheDocument();
    expect(screen.getByText('annotation.cancel')).toBeInTheDocument();
  });

  it('calls handleEdit when clicking save in edit mode', () => {
    const props = {
      ...baseProps,
      editingComment: 'c1',
      editText: 'Edited text',
    };
    render(<CommentItem {...props} />);
    fireEvent.click(screen.getByText('annotation.save'));
    expect(baseProps.handleEdit).toHaveBeenCalledWith('c1');
  });

  it('calls setEditingComment(null) when clicking cancel', () => {
    const props = {
      ...baseProps,
      editingComment: 'c1',
      editText: 'Edited text',
    };
    render(<CommentItem {...props} />);
    fireEvent.click(screen.getByText('annotation.cancel'));
    expect(baseProps.setEditingComment).toHaveBeenCalledWith(null);
  });

  it('shows reply mode when replying', () => {
    const props = {
      ...baseProps,
      replyingTo: 'c1',
      replyText: '',
    };
    render(<CommentItem {...props} />);
    expect(screen.getByPlaceholderText('comment.reply')).toBeInTheDocument();
    expect(screen.getAllByText('comment.reply')).toHaveLength(2);
    expect(screen.getByText('annotation.cancel')).toBeInTheDocument();
  });

  it('calls handleReply when clicking reply button in reply mode', () => {
    const props = {
      ...baseProps,
      replyingTo: 'c1',
      replyText: 'Reply text',
    };
    render(<CommentItem {...props} />);
    const replyButtons = screen.getAllByText('comment.reply');
    fireEvent.click(replyButtons[0]);
    expect(baseProps.handleReply).toHaveBeenCalledWith('c1');
  });

  it('renders replies when present', () => {
    const props = {
      ...baseProps,
      comment: {
        ...baseProps.comment,
        replies: [
          {
            id: 'r1',
            body: 'Reply 1',
            userEmail: 'reply@example.com',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'open' as const,
            visibility: 'shared' as const,
            selectedText: '',
            chapterRef: null,
            cfiRange: null,
            parentCommentId: 'c1',
            resolvedAt: null,
          },
        ],
      },
    };
    render(<CommentItem {...props} />);
    expect(screen.getByText('Reply 1')).toBeInTheDocument();
  });
});

describe('HighlightItem', () => {
  const baseProps = {
    highlight: {
      id: 'h1',
      selectedText: 'Selected text',
      color: '#ff0000',
      note: 'My note',
      chapterRef: 'ch1',
      cfiRange: 'cfi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    isCurrentChapter: true,
    editingHighlight: null,
    highlightNote: '',
    setEditingHighlight: vi.fn(),
    setHighlightNote: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onNavigate: vi.fn(),
  };

  it('renders highlight text', () => {
    render(<HighlightItem {...baseProps} />);
    expect(screen.getByText('Selected text')).toBeInTheDocument();
  });

  it('renders note when present', () => {
    render(<HighlightItem {...baseProps} />);
    expect(screen.getByText('My note')).toBeInTheDocument();
  });

  it('calls onNavigate when clicking highlight text', () => {
    render(<HighlightItem {...baseProps} />);
    fireEvent.click(screen.getByText('Selected text'));
    expect(baseProps.onNavigate).toHaveBeenCalled();
  });

  it('shows action buttons on hover', () => {
    render(<HighlightItem {...baseProps} />);
    const container = screen.getByText('Selected text').parentElement;
    if (container) {
      fireEvent.mouseEnter(container);
    }
    expect(screen.getByText('annotation.editNote')).toBeInTheDocument();
    expect(screen.getByText('annotation.delete')).toBeInTheDocument();
  });

  it('calls setEditingHighlight when clicking edit', () => {
    render(<HighlightItem {...baseProps} />);
    const container = screen.getByText('Selected text').parentElement;
    if (container) {
      fireEvent.mouseEnter(container);
    }
    fireEvent.click(screen.getByText('annotation.editNote'));
    expect(baseProps.setEditingHighlight).toHaveBeenCalledWith('h1');
    expect(baseProps.setHighlightNote).toHaveBeenCalledWith('My note');
  });

  it('calls onDelete when clicking delete', () => {
    render(<HighlightItem {...baseProps} />);
    const container = screen.getByText('Selected text').parentElement;
    if (container) {
      fireEvent.mouseEnter(container);
    }
    fireEvent.click(screen.getByText('annotation.delete'));
    expect(baseProps.onDelete).toHaveBeenCalledWith('h1');
  });

  it('shows edit mode when editing', () => {
    const props = {
      ...baseProps,
      editingHighlight: 'h1',
      highlightNote: 'Edited note',
    };
    render(<HighlightItem {...props} />);
    expect(screen.getByDisplayValue('Edited note')).toBeInTheDocument();
    expect(screen.getByText('annotation.save')).toBeInTheDocument();
    expect(screen.getByText('annotation.cancel')).toBeInTheDocument();
  });

  it('calls onEdit when clicking save in edit mode', () => {
    const props = {
      ...baseProps,
      editingHighlight: 'h1',
      highlightNote: 'Edited note',
    };
    render(<HighlightItem {...props} />);
    fireEvent.click(screen.getByText('annotation.save'));
    expect(baseProps.onEdit).toHaveBeenCalledWith('h1');
  });

  it('calls setEditingHighlight(null) when clicking cancel', () => {
    const props = {
      ...baseProps,
      editingHighlight: 'h1',
      highlightNote: 'Edited note',
    };
    render(<HighlightItem {...props} />);
    fireEvent.click(screen.getByText('annotation.cancel'));
    expect(baseProps.setEditingHighlight).toHaveBeenCalledWith(null);
  });

  it('truncates long text', () => {
    const props = {
      ...baseProps,
      highlight: {
        ...baseProps.highlight,
        selectedText: 'a'.repeat(200),
      },
    };
    render(<HighlightItem {...props} />);
    expect(screen.getByText(/a+\.\.\./)).toBeInTheDocument();
  });
});
