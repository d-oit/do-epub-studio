import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HighlightItem } from './HighlightItem';
import type { Highlight } from '../../../../stores';

vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const baseHighlight: Highlight = {
  id: 'hl-1',
  chapterRef: 'chapter-1',
  cfiRange: 'epubcfi(/6/4)',
  selectedText: 'Hello world',
  color: '#ffff00',
  note: 'My note',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const defaultProps = {
  highlight: baseHighlight,
  isCurrentChapter: true,
  editingHighlight: null,
  highlightNote: '',
  setEditingHighlight: vi.fn(),
  setHighlightNote: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onNavigate: vi.fn(),
};

describe('HighlightItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders highlight text', () => {
    render(<HighlightItem {...defaultProps} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders note when present', () => {
    render(<HighlightItem {...defaultProps} />);
    expect(screen.getByText('My note')).toBeInTheDocument();
  });

  it('applies current chapter styling', () => {
    const { container } = render(<HighlightItem {...defaultProps} isCurrentChapter={true} />);
    expect(container.firstElementChild).toHaveClass('border-accent/30');
  });

  it('applies non-current chapter styling', () => {
    const { container } = render(<HighlightItem {...defaultProps} isCurrentChapter={false} />);
    expect(container.firstElementChild).toHaveClass('border-border');
  });

  it('calls onNavigate when text clicked', () => {
    render(<HighlightItem {...defaultProps} />);
    fireEvent.click(screen.getByText('Hello world'));
    expect(defaultProps.onNavigate).toHaveBeenCalled();
  });

  it('shows actions on mouse enter', () => {
    const { container } = render(<HighlightItem {...defaultProps} />);
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    expect(screen.getByText('Edit Note')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides actions on mouse leave', () => {
    const { container } = render(<HighlightItem {...defaultProps} />);
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    expect(screen.getByText('Edit Note')).toBeInTheDocument();
    fireEvent.mouseLeave(container.firstElementChild as HTMLElement);
    expect(screen.queryByText('Edit Note')).not.toBeInTheDocument();
  });

  it('enters editing mode on Edit Note click', () => {
    const { container } = render(<HighlightItem {...defaultProps} />);
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    fireEvent.click(screen.getByText('Edit Note'));
    expect(defaultProps.setEditingHighlight).toHaveBeenCalledWith('hl-1');
    expect(defaultProps.setHighlightNote).toHaveBeenCalledWith('My note');
  });

  it('calls onDelete with id', () => {
    const { container } = render(<HighlightItem {...defaultProps} />);
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    fireEvent.click(screen.getByText('Delete'));
    expect(defaultProps.onDelete).toHaveBeenCalledWith('hl-1');
  });

  it('truncates text over 150 chars', () => {
    const longHighlight = {
      ...baseHighlight,
      selectedText: 'A'.repeat(200),
    };
    render(<HighlightItem {...defaultProps} highlight={longHighlight} />);
    expect(screen.getByText(/A+\.\.\./)).toBeInTheDocument();
  });

  it('does not show note when editing', () => {
    render(<HighlightItem {...defaultProps} editingHighlight="hl-1" highlightNote="Edit text" />);
    expect(screen.queryByText('My note')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Edit text')).toBeInTheDocument();
  });

  it('shows save and cancel buttons in edit mode', () => {
    render(<HighlightItem {...defaultProps} editingHighlight="hl-1" highlightNote="Edit text" />);
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onEdit with id on save', () => {
    render(<HighlightItem {...defaultProps} editingHighlight="hl-1" highlightNote="Updated note" />);
    fireEvent.click(screen.getByText('Save'));
    expect(defaultProps.onEdit).toHaveBeenCalledWith('hl-1');
  });

  it('clears editing on cancel', () => {
    render(<HighlightItem {...defaultProps} editingHighlight="hl-1" highlightNote="text" />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.setEditingHighlight).toHaveBeenCalledWith(null);
  });

  it('handles keyboard navigation on text', () => {
    render(<HighlightItem {...defaultProps} />);
    const textEl = screen.getByText('Hello world');
    fireEvent.keyDown(textEl, { key: 'Enter' });
    expect(defaultProps.onNavigate).toHaveBeenCalled();
  });

  it('sets note empty string when highlight has no note', () => {
    const noNote = { ...baseHighlight, note: '' };
    const { container } = render(<HighlightItem {...defaultProps} highlight={noNote} />);
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement);
    fireEvent.click(screen.getByText('Edit Note'));
    expect(defaultProps.setHighlightNote).toHaveBeenCalledWith('');
  });
});
