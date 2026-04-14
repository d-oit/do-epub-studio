import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentInput } from './CommentInput';

describe('CommentInput', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders textarea with placeholder', () => {
      render(
        <CommentInput onSubmit={mockOnSubmit} placeholder="Write a comment..." />,
      );

      expect(screen.getByPlaceholderText('Write a comment...')).toBeInTheDocument();
    });

    it('renders submit button with default label', () => {
      render(<CommentInput onSubmit={mockOnSubmit} />);

      expect(screen.getByRole('button', { name: 'Comment' })).toBeInTheDocument();
    });

    it('renders submit button with custom label', () => {
      render(<CommentInput onSubmit={mockOnSubmit} submitLabel="Reply" />);

      expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
    });

    it('renders cancel button when onCancel is provided', () => {
      render(<CommentInput onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not render cancel button when onCancel is not provided', () => {
      render(<CommentInput onSubmit={mockOnSubmit} />);

      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });

    it('renders keyboard hint', () => {
      render(<CommentInput onSubmit={mockOnSubmit} />);

      expect(screen.getByText('Ctrl+Enter to submit')).toBeInTheDocument();
    });

    it('applies reply styling when isReply is true', () => {
      render(<CommentInput onSubmit={mockOnSubmit} isReply={true} />);

      const container = screen.getByPlaceholderText('Write a comment...').closest('div');
      expect(container).toHaveClass('pl-4');
      expect(container).toHaveClass('border-l-2');
    });
  });

  describe('initial text', () => {
    it('displays initial text when provided', () => {
      render(
        <CommentInput onSubmit={mockOnSubmit} initialText="Existing comment" />,
      );

      expect(screen.getByDisplayValue('Existing comment')).toBeInTheDocument();
    });
  });

  describe('auto focus', () => {
    it('focuses textarea when autoFocus is true', async () => {
      // eslint-disable-next-line jsx-a11y/no-autofocus -- Testing autoFocus prop behavior
      render(<CommentInput onSubmit={mockOnSubmit} autoFocus={true} />);

      await vi.waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveFocus();
      });
    });
  });

  describe('submit button state', () => {
    it('disables submit button when text is empty', () => {
      render(<CommentInput onSubmit={mockOnSubmit} />);

      expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
    });

    it('disables submit button when text is only whitespace', async () => {
      const user = userEvent.setup();
      render(<CommentInput onSubmit={mockOnSubmit} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '   ');

      expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
    });

    it('enables submit button when text is present', async () => {
      const user = userEvent.setup();
      render(<CommentInput onSubmit={mockOnSubmit} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Some comment');

      expect(screen.getByRole('button', { name: 'Comment' })).not.toBeDisabled();
    });
  });

  describe('interactions', () => {
    it('calls onSubmit with trimmed text when submit button is clicked', async () => {
      const user = userEvent.setup();
      render(<CommentInput onSubmit={mockOnSubmit} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '  My comment  ');

      await user.click(screen.getByRole('button', { name: 'Comment' }));

      expect(mockOnSubmit).toHaveBeenCalledWith('My comment');
    });

    it('clears textarea after submit', async () => {
      const user = userEvent.setup();
      render(<CommentInput onSubmit={mockOnSubmit} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'My comment');
      await user.click(screen.getByRole('button', { name: 'Comment' }));

      expect(textarea).toHaveValue('');
    });

    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<CommentInput onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('keyboard shortcuts', () => {
    it('calls onSubmit when Ctrl+Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<CommentInput onSubmit={mockOnSubmit} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'My comment');
      await user.type(textarea, '{Control>}{Enter}{/Control}');

      expect(mockOnSubmit).toHaveBeenCalledWith('My comment');
    });

    it('calls onSubmit when Meta+Enter (Cmd+Enter) is pressed', async () => {
      const user = userEvent.setup();
      render(<CommentInput onSubmit={mockOnSubmit} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'My comment');
      await user.type(textarea, '{Meta>}{Enter}{/Meta}');

      expect(mockOnSubmit).toHaveBeenCalledWith('My comment');
    });

    it('calls onCancel when Escape is pressed', async () => {
      const user = userEvent.setup();
      render(<CommentInput onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const textarea = screen.getByRole('textbox');
      await user.click(textarea);
      fireEvent.keyDown(textarea, { key: 'Escape' });

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('does not call onCancel when Escape is pressed without onCancel prop', () => {
      render(<CommentInput onSubmit={mockOnSubmit} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Escape' });

      // Should not throw or call anything - just ignored
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });
});