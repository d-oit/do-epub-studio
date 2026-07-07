import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminBookResponsesPage } from '../features/admin/BooksPage';
import { useAuthStore } from '../stores/auth';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@do-epub-studio/shared', () => ({
  validateEpub: vi.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
}));

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../components/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

vi.mock('../components/ui', () => ({
  Modal: ({ isOpen, children, title }: any) => isOpen ? (
    <div data-testid="modal"><h2>{title}</h2>{children}</div>
  ) : null,
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
  ConfirmDialog: ({ isOpen, onCancel, onConfirm }: any) => isOpen ? (
    <div role="dialog"><button onClick={onCancel}>cancel</button><button onClick={onConfirm}>confirm</button></div>
  ) : null,
}));

import { apiRequest } from '../lib/api';
const mockApiRequest = vi.mocked(apiRequest);

function renderBooksPage() {
  return render(
    <MemoryRouter>
      <AdminBookResponsesPage />
    </MemoryRouter>,
  );
}

describe('AdminBookResponsesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ sessionToken: 'token-123' });
  });

  it('renders title', async () => {
    mockApiRequest.mockResolvedValue([]);
    renderBooksPage();
    await waitFor(() => {
      expect(screen.getByText('admin.books.title')).toBeInTheDocument();
    });
  });

  it('renders books after loading', async () => {
    mockApiRequest.mockResolvedValue([
      { id: '1', title: 'Book 1', slug: 'book-1', authorName: 'Author 1', visibility: 'private', description: 'Desc' },
    ]);
    renderBooksPage();
    await waitFor(() => {
      expect(screen.getByText('Book 1')).toBeInTheDocument();
    });
  });

  it('shows error on fetch failure', async () => {
    mockApiRequest.mockRejectedValue(new Error('Failed'));
    renderBooksPage();
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  it('shows empty state', async () => {
    mockApiRequest.mockResolvedValue([]);
    renderBooksPage();
    await waitFor(() => {
      expect(screen.getByText('admin.books.noBookResponses')).toBeInTheDocument();
    });
  });

  it('opens create modal', async () => {
    mockApiRequest.mockResolvedValue([]);
    renderBooksPage();
    await waitFor(() => {
      expect(screen.getByText('admin.createBook')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('admin.createBook'));
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });
});
