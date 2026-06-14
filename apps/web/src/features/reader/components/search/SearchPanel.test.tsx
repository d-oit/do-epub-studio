import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchPanel } from './SearchPanel';
import * as useReaderSearchHook from '../../hooks/useReaderSearch';

vi.mock('../../hooks/useReaderSearch', () => ({
  useReaderSearch: vi.fn(),
}));

describe('SearchPanel', () => {
  const mockOnClose = vi.fn();
  const mockOnNavigate = vi.fn();
  const mockT = vi.fn((key) => key);
  const mockBook = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input + zero results on empty query', () => {
    (useReaderSearchHook.useReaderSearch as any).mockReturnValue({
      results: [],
      isSearching: false,
    });

    render(
      <SearchPanel
        isOpen={true}
        book={mockBook}
        onClose={mockOnClose}
        onNavigate={mockOnNavigate}
        t={mockT}
      />
    );

    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.queryByText('reader.searchMatches')).not.toBeInTheDocument();
  });

  it('shows results after typing and waiting for debounce', () => {
    const mockResults = [
      { cfi: 'epubcfi(/1/2)', snippet: 'The quick brown <mark>fox</mark>', chapterTitle: 'Chapter 1' },
    ];
    (useReaderSearchHook.useReaderSearch as any).mockReturnValue({
      results: mockResults,
      isSearching: false,
    });

    render(
      <SearchPanel
        isOpen={true}
        book={mockBook}
        onClose={mockOnClose}
        onNavigate={mockOnNavigate}
        t={mockT}
      />
    );

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'fox' } });

    expect(screen.getByText('reader.searchMatches')).toBeInTheDocument();
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    // snippet is rendered with dangerouslySetInnerHTML, we can check for text content
    expect(screen.getByText(/The quick brown/)).toBeInTheDocument();
  });

  it('invokes navigation callback on result click', () => {
    const mockResults = [
      { cfi: 'epubcfi(/1/2)', snippet: 'The quick brown <mark>fox</mark>', chapterTitle: 'Chapter 1' },
    ];
    (useReaderSearchHook.useReaderSearch as any).mockReturnValue({
      results: mockResults,
      isSearching: false,
    });

    render(
      <SearchPanel
        isOpen={true}
        book={mockBook}
        onClose={mockOnClose}
        onNavigate={mockOnNavigate}
        t={mockT}
      />
    );

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'fox' } });

    const resultButton = screen.getByRole('button', { name: /Chapter 1/ });
    fireEvent.click(resultButton);

    expect(mockOnNavigate).toHaveBeenCalledWith('epubcfi(/1/2)');
  });

  it('shows no results message when query has no matches', () => {
    (useReaderSearchHook.useReaderSearch as any).mockReturnValue({
      results: [],
      isSearching: false,
    });

    render(
      <SearchPanel
        isOpen={true}
        book={mockBook}
        onClose={mockOnClose}
        onNavigate={mockOnNavigate}
        t={mockT}
      />
    );

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'xyz' } });

    expect(screen.getByText('reader.searchNoResults')).toBeInTheDocument();
  });
});
