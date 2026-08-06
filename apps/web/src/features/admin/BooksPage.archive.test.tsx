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

const BOOK = { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null };

function clickArchiveConfirm() {
  const btn = screen.getAllByText('admin.books.archive').find(
    (el) => el.tagName === 'BUTTON' && el.closest('[role="dialog"]'),
  );
  expect(btn).toBeTruthy();
  btn?.click();
}

describe('AdminBookResponsesPage — archive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles archive confirmation denied', async () => {
    vi.mocked(apiRequest).mockResolvedValue([BOOK]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.archive'));
    // ConfirmDialog opens — click cancel
    fireEvent.click(screen.getByText('annotation.cancel'));
    expect(apiRequest).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/books/1'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('handles archive confirmation accepted', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce([BOOK])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.archive'));
    // ConfirmDialog opens — click confirm
    clickArchiveConfirm();
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/books/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  it('shows archiving indicator', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce([BOOK])
      .mockImplementationOnce(() => new Promise(() => {}));
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.archive'));
    clickArchiveConfirm();
    await waitFor(() => {
      expect(screen.getByText('...')).toBeInTheDocument();
    });
  });

  it('handles archive error', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce([BOOK])
      .mockRejectedValueOnce(new Error('Archive failed'));
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.archive'));
    clickArchiveConfirm();
    await waitFor(() => {
      expect(screen.getByText('Archive failed')).toBeInTheDocument();
    });
  });

  it('disables archive button while archiving', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce([BOOK])
      .mockImplementationOnce(() => new Promise(() => {}));
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.archive'));
    clickArchiveConfirm();
    await waitFor(() => {
      const archiveButton = screen.getByText('...');
      expect(archiveButton).toBeDisabled();
    });
  });

  it('shows success message after archive', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce([BOOK])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.archive'));
    clickArchiveConfirm();
    await waitFor(() => {
      expect(screen.getByText('admin.books.archiveSuccess')).toBeInTheDocument();
    });
  });
});
