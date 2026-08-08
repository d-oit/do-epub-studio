import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommentItem } from './CommentItem';
import type { Comment } from '../../../../stores';

vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const tFn = (k: string) => k;

const baseComment: Comment = {
  id: 'c1',
  chapterRef: 'ch-1',
  cfiRange: 'epubcfi(/6/4)',
  selectedText: 'quoted text',
  body: 'This is a comment',
  userEmail: 'user@test.com',
  status: 'open',
  visibility: 'shared',
  parentCommentId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  resolvedAt: null,
  replies: [],
};

const defaultProps = {
  comment: baseComment,
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
  t: tFn,
};

describe('CommentItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders comment body', () => {
    render(<CommentItem {...defaultProps} />);
    expect(screen.getByText('This is a comment')).toBeInTheDocument();
  });

  it('renders selected text quote', () => {
    render(<CommentItem {...defaultProps} />);
    expect(screen.getByText(/quoted text/)).toBeInTheDocument();
  });

  it('renders user email and date', () => {
    render(<CommentItem {...defaultProps} />);
    expect(screen.getByText(/user@test.com/)).toBeInTheDocument();
  });

  it('applies current chapter styling', () => {
    const { container } = render(<CommentItem {...defaultProps} isCurrentChapter={true} />);
    expect(container.firstElementChild).toHaveClass('border-accent/30');
  });

  it('applies non-current chapter styling', () => {
    const { container } = render(<CommentItem {...defaultProps} isCurrentChapter={false} />);
    expect(container.firstElementChild).toHaveClass('border-border');
  });

  it('calls onNavigate when quote clicked', () => {
    render(<CommentItem {...defaultProps} />);
    fireEvent.click(screen.getByText(/quoted text/));
    expect(defaultProps.onNavigate).toHaveBeenCalled();
  });

  it('shows actions on mouse enter', () => {
    const { container } = render(<CommentItem {...defaultProps} />);
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    expect(screen.getByText('comment.reply')).toBeInTheDocument();
    expect(screen.getByText('comment.edit')).toBeInTheDocument();
    expect(screen.getByText('comment.resolve')).toBeInTheDocument();
    expect(screen.getByText('comment.delete')).toBeInTheDocument();
  });

  it('hides actions on mouse leave', () => {
    const { container } = render(<CommentItem {...defaultProps} />);
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    expect(screen.getByText('comment.reply')).toBeInTheDocument();
    fireEvent.mouseLeave(container.firstElementChild as HTMLElement);
    expect(screen.queryByText('comment.reply')).not.toBeInTheDocument();
  });

  it('shows reply form on Reply click', () => {
    const { container } = render(<CommentItem {...defaultProps} />);
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    fireEvent.click(screen.getByText('comment.reply'));
    expect(defaultProps.setReplyingTo).toHaveBeenCalledWith('c1');
    expect(defaultProps.setReplyText).toHaveBeenCalledWith('');
  });

  it('shows edit form on Edit click', () => {
    const { container } = render(<CommentItem {...defaultProps} />);
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    fireEvent.click(screen.getByText('comment.edit'));
    expect(defaultProps.setEditingComment).toHaveBeenCalledWith('c1');
    expect(defaultProps.setEditText).toHaveBeenCalledWith('This is a comment');
  });

  it('calls onResolve on Resolve click', () => {
    const { container } = render(<CommentItem {...defaultProps} />);
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    fireEvent.click(screen.getByText('comment.resolve'));
    expect(defaultProps.onResolve).toHaveBeenCalledWith('c1');
  });

  it('calls onDelete on Delete click', () => {
    const { container } = render(<CommentItem {...defaultProps} />);
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    fireEvent.click(screen.getByText('comment.delete'));
    expect(defaultProps.onDelete).toHaveBeenCalledWith('c1');
  });

  it('shows editing textarea when editing', () => {
    render(<CommentItem {...defaultProps} editingComment="c1" editText="Edit content" />);
    expect(screen.getByDisplayValue('Edit content')).toBeInTheDocument();
    expect(screen.getByText('annotation.save')).toBeInTheDocument();
    expect(screen.getByText('annotation.cancel')).toBeInTheDocument();
  });

  it('calls handleEdit on save', () => {
    render(<CommentItem {...defaultProps} editingComment="c1" editText="Updated" />);
    fireEvent.click(screen.getByText('annotation.save'));
    expect(defaultProps.handleEdit).toHaveBeenCalledWith('c1');
  });

  it('clears editing on cancel', () => {
    render(<CommentItem {...defaultProps} editingComment="c1" editText="text" />);
    fireEvent.click(screen.getByText('annotation.cancel'));
    expect(defaultProps.setEditingComment).toHaveBeenCalledWith(null);
  });

  it('shows reply textarea when replying', () => {
    render(<CommentItem {...defaultProps} replyingTo="c1" replyText="My reply" />);
    expect(screen.getByDisplayValue('My reply')).toBeInTheDocument();
    expect(screen.getByText('annotation.cancel')).toBeInTheDocument();
  });

  it('calls handleReply on reply submit', () => {
    render(<CommentItem {...defaultProps} replyingTo="c1" replyText="My reply" />);
    const cancelBtn = screen.getByText('annotation.cancel');
    const replyForm = cancelBtn.parentElement as HTMLElement;
    const submitBtn = replyForm.querySelector('button:first-child') as HTMLElement;
    fireEvent.click(submitBtn);
    expect(defaultProps.handleReply).toHaveBeenCalledWith('c1');
  });

  it('clears reply on cancel', () => {
    render(<CommentItem {...defaultProps} replyingTo="c1" replyText="text" />);
    fireEvent.click(screen.getByText('annotation.cancel'));
    expect(defaultProps.setReplyingTo).toHaveBeenCalledWith(null);
  });

  it('renders replies', () => {
    const commentWithReplies = {
      ...baseComment,
      replies: [
        { id: 'r1', body: 'Reply one', userEmail: 'reply@test.com', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), chapterRef: null, cfiRange: null, selectedText: null, status: 'open' as const, visibility: 'shared' as const, parentCommentId: 'c1', resolvedAt: null },
        { id: 'r2', body: 'Reply two', userEmail: 'reply2@test.com', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), chapterRef: null, cfiRange: null, selectedText: null, status: 'open' as const, visibility: 'shared' as const, parentCommentId: 'c1', resolvedAt: null },
      ] as Comment[],
    };
    render(<CommentItem {...defaultProps} comment={commentWithReplies} />);
    expect(screen.getByText('Reply one')).toBeInTheDocument();
    expect(screen.getByText('Reply two')).toBeInTheDocument();
  });

  it('shows resolved badge when resolved', () => {
    const resolved = { ...baseComment, status: 'resolved' as const };
    render(<CommentItem {...defaultProps} comment={resolved} />);
    expect(screen.getByText('comment.resolved')).toBeInTheDocument();
  });

  it('shows unresolve button for resolved comments on hover', () => {
    const resolved = { ...baseComment, status: 'resolved' as const };
    const { container } = render(<CommentItem {...defaultProps} comment={resolved} />);
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    expect(screen.getByText('comment.unresolve')).toBeInTheDocument();
  });

  it('truncates selected text over 100 chars', () => {
    const longComment = { ...baseComment, selectedText: 'A'.repeat(150) };
    render(<CommentItem {...defaultProps} comment={longComment} />);
    expect(screen.getByText(/A+\.\.\./)).toBeInTheDocument();
  });

  it('renders without selected text', () => {
    const noQuote = { ...baseComment, selectedText: '' };
    render(<CommentItem {...defaultProps} comment={noQuote} />);
    expect(screen.getByText('This is a comment')).toBeInTheDocument();
    expect(screen.queryByText(/quoted text/)).not.toBeInTheDocument();
  });

  it('handles keyboard navigation on quote', () => {
    render(<CommentItem {...defaultProps} />);
    const quote = screen.getByText(/quoted text/);
    fireEvent.keyDown(quote, { key: 'Enter' });
    expect(defaultProps.onNavigate).toHaveBeenCalled();
  });
});
