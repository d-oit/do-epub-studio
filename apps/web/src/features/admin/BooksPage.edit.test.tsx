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

describe('AdminBookResponsesPage — edit modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens edit modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([BOOK]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    expect(screen.getByText('admin.books.editTitle')).toBeInTheDocument();
  });

  it('closes edit modal on cancel', async () => {
    vi.mocked(apiRequest).mockResolvedValue([BOOK]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    expect(screen.getByText('admin.books.editTitle')).toBeInTheDocument();
    const closeButtons = screen.getAllByText('admin.createBookModal.close');
    if (closeButtons.length > 0) {
      fireEvent.click(closeButtons[0]);
    }
  });

  it('closes edit modal on Escape key', async () => {
    vi.mocked(apiRequest).mockResolvedValue([BOOK]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    expect(screen.getByText('admin.books.editTitle')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('admin.books.editTitle')).not.toBeInTheDocument();
    });
  });

  it('allows editing author with empty string', async () => {
    vi.mocked(apiRequest).mockResolvedValue([BOOK]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    const authorInput = screen.getAllByRole('textbox')[1];
    fireEvent.change(authorInput, { target: { value: '' } });
    expect(authorInput).toHaveValue('');
  });

  it('allows editing description with empty string', async () => {
    vi.mocked(apiRequest).mockResolvedValue([BOOK]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    const descInput = screen.getAllByRole('textbox')[2];
    fireEvent.change(descInput, { target: { value: '' } });
    expect(descInput).toHaveValue('');
  });

  it('allows editing title in edit modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([BOOK]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    const titleInput = screen.getAllByRole('textbox')[0];
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    expect(titleInput).toHaveValue('Updated Title');
  });

  it('allows editing author in edit modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([BOOK]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    const authorInput = screen.getAllByRole('textbox')[1];
    fireEvent.change(authorInput, { target: { value: 'New Author' } });
    expect(authorInput).toHaveValue('New Author');
  });

  it('allows editing description in edit modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([BOOK]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    const descInput = screen.getAllByRole('textbox')[2];
    fireEvent.change(descInput, { target: { value: 'New Description' } });
    expect(descInput).toHaveValue('New Description');
  });

  it('allows editing visibility in edit modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([BOOK]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'private' } });
    expect(select).toHaveValue('private');
  });

  it('handles edit form submission', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce([BOOK])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce([BOOK]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    expect(screen.getByText('admin.books.editTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByText('admin.books.saveChanges'));
    await waitFor(() => {
      expect(screen.getByText('admin.books.updateSuccess')).toBeInTheDocument();
    });
  });

  it('handles edit form error', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce([BOOK])
      .mockRejectedValueOnce(new Error('Update failed'));
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    fireEvent.click(screen.getByText('admin.books.saveChanges'));
    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });
  });

  it('shows success message after update', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce([BOOK])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    fireEvent.click(screen.getByText('admin.books.saveChanges'));
    await waitFor(() => {
      expect(screen.getByText('admin.books.updateSuccess')).toBeInTheDocument();
    });
  });
});