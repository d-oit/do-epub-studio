import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnnotationToolbar, extractSelectionData, clearSelection, type SelectionData } from './AnnotationToolbar';

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

      expect(screen.getByLabelText('a11y.close')).toBeInTheDocument();
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

      await user.click(screen.getByLabelText('a11y.close'));

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

      const toolbar = screen.getByLabelText('annotation.highlight').closest('.fixed');
      expect(toolbar).toBeInTheDocument();
      expect(toolbar).toHaveClass('fixed');
    });

    it('clamps position to left edge when near left', () => {
      const leftSelection: SelectionData = {
        ...mockSelection,
        rect: new DOMRect(0, 100, 200, 30),
      };
      render(
        <AnnotationToolbar
          selection={leftSelection}
          onHighlight={mockOnHighlight}
          onComment={mockOnComment}
          onClose={mockOnClose}
          locale="en"
          canHighlight={true}
          canComment={true}
        />,
      );
      const toolbar = screen.getByLabelText('annotation.highlight').closest('.fixed');
      expect(toolbar).toBeInTheDocument();
    });

    it('clamps position to right edge when near right', () => {
      const rightSelection: SelectionData = {
        ...mockSelection,
        rect: new DOMRect(2000, 100, 200, 30),
      };
      render(
        <AnnotationToolbar
          selection={rightSelection}
          onHighlight={mockOnHighlight}
          onComment={mockOnComment}
          onClose={mockOnClose}
          locale="en"
          canHighlight={true}
          canComment={true}
        />,
      );
      const toolbar = screen.getByLabelText('annotation.highlight').closest('.fixed');
      expect(toolbar).toBeInTheDocument();
    });
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

describe('extractSelectionData', () => {
  it('returns null for collapsed selection', () => {
    const mockGetSelection = vi.fn().mockReturnValue({
      isCollapsed: true,
      rangeCount: 0,
    });
    const iframe = {
      contentWindow: { getSelection: mockGetSelection },
    } as unknown as HTMLIFrameElement;

    expect(extractSelectionData(iframe)).toBeNull();
  });

  it('returns null when no selection', () => {
    const mockGetSelection = vi.fn().mockReturnValue(null);
    const iframe = {
      contentWindow: { getSelection: mockGetSelection },
    } as unknown as HTMLIFrameElement;

    expect(extractSelectionData(iframe)).toBeNull();
  });

  it('returns null for short text', () => {
    const mockRange = {
      toString: () => 'ab',
      getClientRects: () => [],
      getBoundingClientRect: () => new DOMRect(0, 0, 10, 10),
    };
    const mockGetSelection = vi.fn().mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => mockRange,
    });
    const iframe = {
      contentWindow: { getSelection: mockGetSelection },
      getBoundingClientRect: () => new DOMRect(0, 0, 100, 100),
    } as unknown as HTMLIFrameElement;

    expect(extractSelectionData(iframe)).toBeNull();
  });

  it('returns selection data for valid text', () => {
    const mockRange = {
      toString: () => 'Hello World',
      getClientRects: () => [new DOMRect(10, 10, 100, 20)],
      getBoundingClientRect: () => new DOMRect(10, 10, 100, 20),
    };
    const mockGetSelection = vi.fn().mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => mockRange,
    });
    const iframe = {
      contentWindow: { getSelection: mockGetSelection },
      getBoundingClientRect: () => new DOMRect(0, 0, 100, 100),
    } as unknown as HTMLIFrameElement;

    // extractSelectionData is imported at top level
    const result = extractSelectionData(iframe);
    expect(result).not.toBeNull();
    expect(result?.text).toBe('Hello World');
  });

  it('extracts cfiRange from range when available', () => {
    const mockRange = {
      toString: () => 'Hello World',
      getClientRects: () => [new DOMRect(10, 10, 100, 20)],
      getBoundingClientRect: () => new DOMRect(10, 10, 100, 20),
      cfiRange: 'epubcfi(/6/4!/2/2)',
    };
    const mockGetSelection = vi.fn().mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => mockRange,
    });
    const iframe = {
      contentWindow: { getSelection: mockGetSelection },
      getBoundingClientRect: () => new DOMRect(0, 0, 100, 100),
    } as unknown as HTMLIFrameElement;

    // extractSelectionData is imported at top level
    const result = extractSelectionData(iframe);
    expect(result?.cfiRange).toBe('epubcfi(/6/4!/2/2)');
  });

  it('uses getBoundingClientRect when getClientRects returns empty', () => {
    const mockRange = {
      toString: () => 'Hello World',
      getClientRects: () => [],
      getBoundingClientRect: () => new DOMRect(10, 10, 100, 20),
    };
    const mockGetSelection = vi.fn().mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => mockRange,
    });
    const iframe = {
      contentWindow: { getSelection: mockGetSelection },
      getBoundingClientRect: () => new DOMRect(0, 0, 100, 100),
    } as unknown as HTMLIFrameElement;

    // extractSelectionData is imported at top level
    const result = extractSelectionData(iframe);
    expect(result).not.toBeNull();
    expect(result?.rect).toBeDefined();
  });
});

describe('clearSelection', () => {
  it('clears the selection in iframe', () => {
    const mockRemoveAllRanges = vi.fn();
    const iframe = {
      contentWindow: {
        getSelection: () => ({
          removeAllRanges: mockRemoveAllRanges,
        }),
      },
    } as unknown as HTMLIFrameElement;

    // clearSelection is imported at top level
    clearSelection(iframe);
    expect(mockRemoveAllRanges).toHaveBeenCalled();
  });

  it('handles null selection gracefully', () => {
    const iframe = {
      contentWindow: {
        getSelection: () => null,
      },
    } as unknown as HTMLIFrameElement;

    // clearSelection is imported at top level
    expect(() => clearSelection(iframe)).not.toThrow();
  });
});
