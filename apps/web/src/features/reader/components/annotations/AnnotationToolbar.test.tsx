import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnnotationToolbar, type SelectionData } from './AnnotationToolbar';

// Mock useTranslation hook
vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockSelection: SelectionData = {
  text: 'selected text',
  cfiRange: 'epubcfi(/6/4!/2/2)',
  chapterRef: 'chapter-1',
  rect: new DOMRect(100, 100, 200, 30),
};

describe('AnnotationToolbar', () => {
  const mockOnHighlight = vi.fn();
  const mockOnComment = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders highlight button when canHighlight is true', () => {
      render(
        <AnnotationToolbar
          selection={mockSelection}
          onHighlight={mockOnHighlight}
          onComment={mockOnComment}
          onClose={mockOnClose}
          locale="en"
          canHighlight={true}
          canComment={true}
        />,
      );

      expect(screen.getByLabelText('annotation.highlight')).toBeInTheDocument();
    });

    it('renders comment button when canComment is true', () => {
      render(
        <AnnotationToolbar
          selection={mockSelection}
          onHighlight={mockOnHighlight}
          onComment={mockOnComment}
          onClose={mockOnClose}
          locale="en"
          canHighlight={true}
          canComment={true}
        />,
      );

      expect(screen.getByLabelText('annotation.comment')).toBeInTheDocument();
    });

    it('does not render highlight button when canHighlight is false', () => {
      render(
        <AnnotationToolbar
          selection={mockSelection}
          onHighlight={mockOnHighlight}
          onComment={mockOnComment}
          onClose={mockOnClose}
          locale="en"
          canHighlight={false}
          canComment={true}
        />,
      );

      expect(screen.queryByLabelText('annotation.highlight')).not.toBeInTheDocument();
    });

    it('does not render comment button when canComment is false', () => {
      render(
        <AnnotationToolbar
          selection={mockSelection}
          onHighlight={mockOnHighlight}
          onComment={mockOnComment}
          onClose={mockOnClose}
          locale="en"
          canHighlight={true}
          canComment={false}
        />,
      );

      expect(screen.queryByLabelText('annotation.comment')).not.toBeInTheDocument();
    });

    it('renders close button', () => {
      render(
        <AnnotationToolbar
          selection={mockSelection}
          onHighlight={mockOnHighlight}
          onComment={mockOnComment}
          onClose={mockOnClose}
          locale="en"
          canHighlight={true}
          canComment={true}
        />,
      );

      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('opens color picker when highlight button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <AnnotationToolbar
          selection={mockSelection}
          onHighlight={mockOnHighlight}
          onComment={mockOnComment}
          onClose={mockOnClose}
          locale="en"
          canHighlight={true}
          canComment={true}
        />,
      );

      await user.click(screen.getByLabelText('annotation.highlight'));

      // Color picker should appear with color options
      expect(screen.getByLabelText('annotation.colors.yellow')).toBeInTheDocument();
      expect(screen.getByLabelText('annotation.colors.green')).toBeInTheDocument();
      expect(screen.getByLabelText('annotation.colors.blue')).toBeInTheDocument();
      expect(screen.getByLabelText('annotation.colors.pink')).toBeInTheDocument();
    });

    it('calls onHighlight with color hex when color is selected', async () => {
      const user = userEvent.setup();
      render(
        <AnnotationToolbar
          selection={mockSelection}
          onHighlight={mockOnHighlight}
          onComment={mockOnComment}
          onClose={mockOnClose}
          locale="en"
          canHighlight={true}
          canComment={true}
        />,
      );

      await user.click(screen.getByLabelText('annotation.highlight'));
      await user.click(screen.getByLabelText('annotation.colors.yellow'));

      expect(mockOnHighlight).toHaveBeenCalledWith('#ffff00');
    });

    it('calls onComment when comment button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <AnnotationToolbar
          selection={mockSelection}
          onHighlight={mockOnHighlight}
          onComment={mockOnComment}
          onClose={mockOnClose}
          locale="en"
          canHighlight={true}
          canComment={true}
        />,
      );

      await user.click(screen.getByLabelText('annotation.comment'));

      expect(mockOnComment).toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <AnnotationToolbar
          selection={mockSelection}
          onHighlight={mockOnHighlight}
          onComment={mockOnComment}
          onClose={mockOnClose}
          locale="en"
          canHighlight={true}
          canComment={true}
        />,
      );

      await user.click(screen.getByLabelText('Close'));

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('keyboard accessibility', () => {
    it('calls onClose when Escape key is pressed', () => {
      render(
        <AnnotationToolbar
          selection={mockSelection}
          onHighlight={mockOnHighlight}
          onComment={mockOnComment}
          onClose={mockOnClose}
          locale="en"
          canHighlight={true}
          canComment={true}
        />,
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('click outside behavior', () => {
    it('calls onClose when clicking outside the toolbar', async () => {
      render(
        <div data-testid="outside">
          <AnnotationToolbar
            selection={mockSelection}
            onHighlight={mockOnHighlight}
            onComment={mockOnComment}
            onClose={mockOnClose}
            locale="en"
            canHighlight={true}
            canComment={true}
          />
        </div>,
      );

      // Click outside the toolbar
      fireEvent.mouseDown(screen.getByTestId('outside'), {
        target: screen.getByTestId('outside'),
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('positioning', () => {
    it('positions toolbar based on selection rect', () => {
      render(
        <AnnotationToolbar
          selection={mockSelection}
          onHighlight={mockOnHighlight}
          onComment={mockOnComment}
          onClose={mockOnClose}
          locale="en"
          canHighlight={true}
          canComment={true}
        />,
      );

      // Toolbar is a fixed positioned element
      const toolbar = screen.getByLabelText('annotation.highlight').closest('.fixed');
      expect(toolbar).toBeInTheDocument();
      expect(toolbar).toHaveClass('fixed');
    });
  });
});
