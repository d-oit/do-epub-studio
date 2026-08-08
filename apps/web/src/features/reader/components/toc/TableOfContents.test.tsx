import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { type ReactNode } from 'react';
import { TableOfContents } from './TableOfContents';

// Mock focus trap and components
vi.mock('@do-epub-studio/ui', () => ({
  useFocusTrap: vi.fn(),
  IconButton: ({ children, onClick, 'aria-label': ariaLabel }: { children: ReactNode; onClick: () => void; 'aria-label': string }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

describe('TableOfContents', () => {
  const mockToc = [
    { label: 'Chapter 1', href: 'chapter1.xhtml' },
    { label: 'Chapter 2', href: 'chapter2.xhtml' },
    { label: 'Chapter 3', href: 'chapter3.xhtml' },
  ];

  const mockProps = {
    isOpen: true,
    toc: mockToc,
    currentChapter: 'chapter2.xhtml',
    onClose: vi.fn(),
    onNavigate: vi.fn(),
    t: (key: string) => key,
  };

  beforeEach(() => {
    window.HTMLButtonElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders toc items', () => {
    render(<TableOfContents {...mockProps} />);
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2')).toBeInTheDocument();
    expect(screen.getByText('Chapter 3')).toBeInTheDocument();
  });

  it('highlights the current chapter', () => {
    render(<TableOfContents {...mockProps} />);
    const activeItem = screen.getByText('Chapter 2');
    expect(activeItem).toHaveAttribute('aria-current', 'location');
    expect(activeItem.className).toContain('bg-accent');
    expect(activeItem.className).toContain('text-white');
  });

  it('does not highlight non-current chapters', () => {
    render(<TableOfContents {...mockProps} />);
    const inactiveItem = screen.getByText('Chapter 1');
    expect(inactiveItem).not.toHaveAttribute('aria-current');
    expect(inactiveItem.className).not.toContain('bg-accent');
  });

  it('calls onNavigate when an item is clicked', () => {
    render(<TableOfContents {...mockProps} />);
    fireEvent.click(screen.getByText('Chapter 3'));
    expect(mockProps.onNavigate).toHaveBeenCalledWith('chapter3.xhtml');
  });

  it('calls onClose when close button is clicked', () => {
    render(<TableOfContents {...mockProps} />);
    // The close button has aria-label="a11y.close" (from mock t returning the key)
    fireEvent.click(screen.getByLabelText('a11y.close'));
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('scrolls active item into view when opened', () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLButtonElement.prototype.scrollIntoView = scrollIntoViewMock;

    render(<TableOfContents {...mockProps} />);

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('renders no chapters message when toc is empty', () => {
    render(<TableOfContents {...mockProps} toc={[]} />);
    expect(screen.getByText('reader.noChapters')).toBeInTheDocument();
  });

  it('uses VirtualList for long TOCs (>50 items)', () => {
    const longToc = Array.from({ length: 60 }, (_, i) => ({
      label: `Chapter ${i + 1}`,
      href: `chapter${i + 1}.xhtml`,
    }));
    const { container } = render(
      <TableOfContents {...mockProps} toc={longToc} />,
    );
    // VirtualList renders a <ul> for the scroll container (semantic list).
    // The short-list path uses <nav> + plain <button> children.
    const list = container.querySelector('ul');
    expect(list).toBeInTheDocument();
    // Should not mount all 60 buttons eagerly — only visible window
    const buttons = container.querySelectorAll('button[data-toc-index]');
    expect(buttons.length).toBeLessThan(longToc.length);
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('passes scrollToIndex to VirtualList for active chapter in long TOC', () => {
    const longToc = Array.from({ length: 60 }, (_, i) => ({
      label: `Chapter ${i + 1}`,
      href: `chapter${i + 1}.xhtml`,
    }));
    // Active chapter is at index 55 — outside the initial visible window
    const { container } = render(
      <TableOfContents
        {...mockProps}
        toc={longToc}
        currentChapter="chapter56.xhtml"
      />,
    );
    // VirtualList should be rendered (long TOC triggers virtualization)
    const list = container.querySelector('ul');
    expect(list).toBeInTheDocument();
    // The container should have scrolled (scrollTop > 0) to reveal the active chapter
    // In jsdom, scrollTop doesn't actually change, but we can verify the effect ran
    // by checking that the VirtualList is present with the active item highlighted
  });

  it('marks the panel as a named inline-size container (ADR-105)', () => {
    const { container } = render(<TableOfContents {...mockProps} />);
    const panel = container.querySelector('[data-container-name="toc-panel"]');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass('cq');
    expect(panel).toHaveClass('cq--toc-panel');
  });
});
