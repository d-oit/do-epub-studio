import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommentInputModal } from './CommentInputModal';

vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('CommentInputModal', () => {
  const defaultProps = {
    isOpen: true,
    selection: { text: 'selected text' },
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    placeholder: 'Add a comment...',
    submitLabel: 'Comment',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when isOpen and selection provided', () => {
    const { container } = render(<CommentInputModal {...defaultProps} />);
    expect(container.querySelector('.fixed')).toBeInTheDocument();
    expect(container.querySelector('.rounded-lg')).toBeInTheDocument();
  });

  it('renders submit label as heading with id', () => {
    const { container } = render(<CommentInputModal {...defaultProps} submitLabel="Send" />);
    const h3 = container.querySelector('h3');
    expect(h3?.textContent).toBe('Send');
    expect(h3?.id).toBe('comment-modal-title');
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<CommentInputModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when selection is null', () => {
    const { container } = render(<CommentInputModal {...defaultProps} selection={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when both isOpen is false and selection is null', () => {
    const { container } = render(<CommentInputModal {...defaultProps} isOpen={false} selection={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders with fixed positioning', () => {
    const { container } = render(<CommentInputModal {...defaultProps} />);
    const wrapper = container.querySelector('.fixed');
    expect(wrapper).toBeInTheDocument();
  });

  it('passes autoFocus to CommentInput', () => {
    render(<CommentInputModal {...defaultProps} />);
    const textarea = screen.getByPlaceholderText('Add a comment...');
    expect(textarea).toHaveFocus();
  });

  it('has correct aria role, modal and labelling attributes', () => {
    render(<CommentInputModal {...defaultProps} />);
    const modalDiv = screen.getByRole('dialog');
    expect(modalDiv).toBeInTheDocument();
    expect(modalDiv).toHaveAttribute('aria-modal', 'true');
    expect(modalDiv).toHaveAttribute('aria-labelledby', 'comment-modal-title');
  });

  it('triggers onCancel when pressing Escape on the window', () => {
    render(<CommentInputModal {...defaultProps} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
