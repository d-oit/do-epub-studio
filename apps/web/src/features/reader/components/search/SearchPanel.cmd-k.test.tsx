import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SearchPanel } from './SearchPanel';

describe('SearchPanel Cmd/Ctrl+K and drawer UI', () => {
  const mockT = (key: string, params?: Record<string, unknown>) => {
    if (key === 'reader.search') return 'Search';
    if (key === 'reader.searchPlaceholder') return 'Search book...';
    if (key === 'reader.searchMatches') return `${params?.n} matches found`;
    if (key === 'reader.searchNoResults') return 'No results found';
    return key;
  };

  it('renders correctly when open', () => {
    render(
      <SearchPanel isOpen={true} book={null} onClose={vi.fn()} onNavigate={vi.fn()} t={mockT} />,
    );

    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search book...')).toBeInTheDocument();
  });

  it('handles search input', () => {
    render(
      <SearchPanel isOpen={true} book={null} onClose={vi.fn()} onNavigate={vi.fn()} t={mockT} />,
    );

    const input = screen.getByPlaceholderText('Search book...');
    fireEvent.change(input, { target: { value: 'chapter' } });
    expect(input).toHaveValue('chapter');
  });
});
