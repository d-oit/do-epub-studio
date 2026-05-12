import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminBookResponsesPage } from './BooksPage';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '../../lib/api';

describe('AdminBookResponsesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(screen.getByText('admin.books.title')).toBeInTheDocument();
  });

  it('renders books when loaded', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(await screen.findByText('Test Book')).toBeInTheDocument();
    expect(await screen.findByText('Desc')).toBeInTheDocument();
  });

  it('renders empty state when no books', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(await screen.findByText('admin.books.noBookResponses')).toBeInTheDocument();
  });
});
