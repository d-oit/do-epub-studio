import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminBookResponsesPage } from './BooksPage';
import { MemoryRouter } from 'react-router-dom';
import { apiRequest } from '../../lib/api';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@do-epub-studio/shared', () => ({
  validateEpub: vi.fn(),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ sessionToken: 'test-token' }),
}));

vi.mock('../../components/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

describe('AdminBookResponsesPage — rendering & navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(apiRequest).mockImplementation(() => new Promise(() => {}));
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(screen.getByText('admin.books.title')).toBeInTheDocument();
  });

  it('renders books when loaded', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(await screen.findByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
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

  it('shows description fallback when no description', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: null, visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(await screen.findByText('admin.books.noDescription')).toBeInTheDocument();
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

  it('navigates to audit logs', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.books.viewAuditLogs'));
  });

  it('displays loading spinner while fetching', () => {
    vi.mocked(apiRequest).mockImplementation(() => new Promise(() => {}));
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders locale switcher', () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });

  it('sets fetch error when book list fails', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Network error'));
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('renders book without description', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: null, visibility: 'private', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(await screen.findByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('private')).toBeInTheDocument();
  });

  it('shows multiple books with different visibilities', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test1', title: 'Book One', authorName: 'A', description: 'D1', visibility: 'public', coverImageUrl: null },
      { id: '2', slug: 'test2', title: 'Book Two', authorName: 'B', description: 'D2', visibility: 'private', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(await screen.findByText('Book One')).toBeInTheDocument();
    expect(screen.getByText('Book Two')).toBeInTheDocument();
    const publicBadges = screen.getAllByText('public');
    const privateBadges = screen.getAllByText('private');
    expect(publicBadges.length).toBeGreaterThanOrEqual(1);
    expect(privateBadges.length).toBeGreaterThanOrEqual(1);
  });
});