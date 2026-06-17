import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  it('renders error message on fetch failure', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Failed to fetch'));
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument();
  });

  it('opens create modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    expect(screen.getByText('admin.createBookModal.title')).toBeInTheDocument();
  });

  it('opens edit modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    expect(screen.getByText('admin.books.editTitle')).toBeInTheDocument();
  });

  it('shows book visibility badge', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(await screen.findByText('public')).toBeInTheDocument();
  });

  it('navigates to grants page', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    const manageButtons = screen.getAllByText(/manageAccess/);
    if (manageButtons.length > 0) {
      fireEvent.click(manageButtons[0]);
    }
  });

  it('navigates back to reader', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    const backButtons = screen.getAllByText(/backToReader/);
    if (backButtons.length > 0) {
      fireEvent.click(backButtons[0]);
    }
  });
});
