import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchPanel } from './SearchPanel';
import * as useReaderSearchHook from '../../hooks/useReaderSearch';
import type { Book } from '@intity/epub-js';

vi.mock('../../hooks/useReaderSearch', () => ({
  useReaderSearch: vi.fn(),
  highlightRanges: vi.fn(
    (excerpt: string, query: string) =>
      excerpt.includes(query)
        ? [
            { text: excerpt.slice(0, excerpt.indexOf(query)), hit: false },
            { text: query, hit: true },
            { text: excerpt.slice(excerpt.indexOf(query) + query.length), hit: false },
          ]
        : [{ text: excerpt, hit: false }],
  ),
}));

const mockUseReaderSearch = useReaderSearchHook.useReaderSearch as unknown as ReturnType<typeof vi.fn>;

describe('SearchPanel', () => {
  const mockOnClose = vi.fn();
  const mockOnNavigate = vi.fn();
  const mockT = vi.fn((key: string) => key);
  const mockBook = {} as Book;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input + zero results on empty query', () => {
    mockUseReaderSearch.mockReturnValue({ results: [], isSearching: false, error: null });

    render(
      <SearchPanel
        isOpen
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
      { cfi: 'epubcfi(/1/2)', cfiRange: 'epubcfi(/1/2)', excerpt: 'the quick brown fox', chapterTitle: 'Chapter 1' },
    ];
    mockUseReaderSearch.mockReturnValue({ results: mockResults, isSearching: false, error: null });

    render(
      <SearchPanel
        isOpen
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
    expect(screen.getByText(/the quick brown/)).toBeInTheDocument();
  });

  it('invokes navigation callback on result click', () => {
    const mockResults = [
      { cfi: 'epubcfi(/1/2)', cfiRange: 'epubcfi(/1/2)', excerpt: 'the quick brown fox', chapterTitle: 'Chapter 1' },
    ];
    mockUseReaderSearch.mockReturnValue({ results: mockResults, isSearching: false, error: null });

    render(
      <SearchPanel
        isOpen
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
    mockUseReaderSearch.mockReturnValue({ results: [], isSearching: false, error: null });

    render(
      <SearchPanel
        isOpen
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

  it('shows error message when error is set', () => {
    mockUseReaderSearch.mockReturnValue({ results: [], isSearching: false, error: 'Boom' });
    render(
      <SearchPanel
        isOpen
        book={mockBook}
        onClose={mockOnClose}
        onNavigate={mockOnNavigate}
        t={mockT}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
  });

  it('calls onClose when close button is clicked', () => {
    mockUseReaderSearch.mockReturnValue({ results: [], isSearching: false, error: null });
    render(
      <SearchPanel
        isOpen
        book={mockBook}
        onClose={mockOnClose}
        onNavigate={mockOnNavigate}
        t={mockT}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'a11y.close' }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    mockUseReaderSearch.mockReturnValue({ results: [], isSearching: false, error: null });
    render(
      <SearchPanel
        isOpen={false}
        book={mockBook}
        onClose={mockOnClose}
        onNavigate={mockOnNavigate}
        t={mockT}
      />
    );
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
  });
});
