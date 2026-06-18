import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookSelector } from './BookSelector';

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('BookSelector', () => {
  const defaultProps = {
    books: [
      { id: '1', title: 'Book One', slug: 'book-one' },
      { id: '2', title: 'Book Two', slug: 'book-two' },
    ],
    selectedBookId: '',
    isLoadingBooks: false,
    onSelectBook: vi.fn(),
    onCreateGrant: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders select label', () => {
    render(<BookSelector {...defaultProps} />);
    expect(screen.getByText('grants.selectBook')).toBeInTheDocument();
  });

  it('renders all books option', () => {
    render(<BookSelector {...defaultProps} />);
    expect(screen.getByText('grants.allBooks')).toBeInTheDocument();
  });

  it('renders book options', () => {
    render(<BookSelector {...defaultProps} />);
    expect(screen.getByText('Book One')).toBeInTheDocument();
    expect(screen.getByText('Book Two')).toBeInTheDocument();
  });

  it('calls onSelectBook when selection changes', () => {
    render(<BookSelector {...defaultProps} />);
    fireEvent.change(screen.getByDisplayValue('grants.allBooks'), { target: { value: '1' } });
    expect(defaultProps.onSelectBook).toHaveBeenCalledWith('1');
  });

  it('hides create grant button when no book selected', () => {
    render(<BookSelector {...defaultProps} />);
    expect(screen.queryByText('grants.createGrant')).not.toBeInTheDocument();
  });

  it('shows create grant button when book selected', () => {
    render(<BookSelector {...defaultProps} selectedBookId="1" />);
    expect(screen.getByText('grants.createGrant')).toBeInTheDocument();
  });

  it('calls onCreateGrant when create button clicked', () => {
    render(<BookSelector {...defaultProps} selectedBookId="1" />);
    fireEvent.click(screen.getByText('grants.createGrant'));
    expect(defaultProps.onCreateGrant).toHaveBeenCalled();
  });

  it('disables select when loading', () => {
    render(<BookSelector {...defaultProps} isLoadingBooks={true} />);
    expect(screen.getByDisplayValue('grants.allBooks')).toBeDisabled();
  });

  it('renders empty books list', () => {
    render(<BookSelector {...defaultProps} books={[]} />);
    expect(screen.getByText('grants.allBooks')).toBeInTheDocument();
  });
});
