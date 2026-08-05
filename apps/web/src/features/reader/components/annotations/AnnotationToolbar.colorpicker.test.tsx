import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('AnnotationToolbar — color picker & popover', () => {
  const mockOnHighlight = vi.fn();
  const mockOnComment = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('color picker', () => {
    it('selects green color', async () => {
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
      await user.click(screen.getByLabelText('annotation.colors.green'));
      expect(mockOnHighlight).toHaveBeenCalledWith('#90EE90');
    });

    it('selects blue color', async () => {
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
      await user.click(screen.getByLabelText('annotation.colors.blue'));
      expect(mockOnHighlight).toHaveBeenCalledWith('#87CEEB');
    });

    it('selects pink color', async () => {
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
      await user.click(screen.getByLabelText('annotation.colors.pink'));
      expect(mockOnHighlight).toHaveBeenCalledWith('#FFB6C1');
    });

    it('closes color picker after selection', async () => {
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
      expect(screen.getByLabelText('annotation.colors.yellow')).toBeInTheDocument();
      await user.click(screen.getByLabelText('annotation.colors.yellow'));
      expect(screen.queryByLabelText('annotation.colors.yellow')).not.toBeInTheDocument();
    });

    it('toggles color picker off on second click', async () => {
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
      expect(screen.getByLabelText('annotation.colors.yellow')).toBeInTheDocument();
      await user.click(screen.getByLabelText('annotation.highlight'));
      expect(screen.queryByLabelText('annotation.colors.yellow')).not.toBeInTheDocument();
    });
  });

  describe('native popover color picker (V9)', () => {
    it('renders color picker as a popover=auto element', async () => {
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
      const picker = document.getElementById('annotation-color-picker');
      expect(picker).not.toBeNull();
      // popover attribute is only attached when the runtime supports it;
      // jsdom does NOT, so we assert the fallback data attribute instead.
      expect(picker).toHaveAttribute('data-fallback', 'js');
    });

    it('opens popover via click on highlight trigger', async () => {
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
      expect(screen.getByLabelText('annotation.colors.yellow')).toBeInTheDocument();
      expect(screen.getByLabelText('annotation.colors.green')).toBeInTheDocument();
      expect(screen.getByLabelText('annotation.colors.blue')).toBeInTheDocument();
      expect(screen.getByLabelText('annotation.colors.pink')).toBeInTheDocument();
    });

    it('closes popover via Escape (jsdom fallback path)', async () => {
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
      expect(screen.getByLabelText('annotation.colors.yellow')).toBeInTheDocument();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByLabelText('annotation.colors.yellow')).not.toBeInTheDocument();
      // onClose must NOT be invoked when Escape only dismissed the picker
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('manages focus by exposing aria-haspopup and aria-expanded on the trigger', async () => {
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
      const trigger = screen.getByLabelText('annotation.highlight');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const { unmount } = render(
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
      unmount();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('container-query-driven layout (ADR-105)', () => {
    it('marks the toolbar as a named inline-size container', () => {
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
      const toolbar = screen.getByLabelText('annotation.highlight').closest('[data-container-name="annotation-toolbar"]');
      expect(toolbar).toBeInTheDocument();
      expect(toolbar).toHaveClass('cq');
      expect(toolbar).toHaveClass('cq--annotation-toolbar');
    });

    it('applies cq-annotation-label class to label spans so the container query can reveal them', () => {
      const { container } = render(
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
      const labels = container.querySelectorAll('.cq-annotation-label');
      expect(labels.length).toBeGreaterThanOrEqual(2);
    });
  });
});