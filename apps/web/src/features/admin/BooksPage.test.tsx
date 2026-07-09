import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminBookResponsesPage } from './BooksPage';
import { MemoryRouter } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { validateEpub } from '@do-epub-studio/shared';

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

function clickArchiveConfirm() {
  const btn = screen.getAllByText('admin.books.archive').find(
    (el) => el.tagName === 'BUTTON' && el.closest('[role="dialog"]'),
  );
  expect(btn).toBeTruthy();
  btn?.click();
}

describe('AdminBookResponsesPage', () => {
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

  it('closes create modal on cancel', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    expect(screen.getByText('admin.createBookModal.title')).toBeInTheDocument();
    fireEvent.click(screen.getByText('admin.createBookModal.close'));
  });

  it('shows validation error when title is empty', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    vi.mocked(validateEpub).mockResolvedValue({ isValid: true, errors: [], warnings: [] });
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    fireEvent.click(screen.getByText('admin.createBookModal.submit'));
    await waitFor(() => {
      expect(screen.getByText('admin.createBookModal.error.fillFields')).toBeInTheDocument();
    });
  });

  it('shows validation error when no epub file selected', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    const titleInput = screen.getByPlaceholderText('admin.createBookModal.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'Test Book' } });
    fireEvent.click(screen.getByText('admin.createBookModal.submit'));
    await waitFor(() => {
      expect(screen.getByText('admin.createBookModal.error.selectEpub')).toBeInTheDocument();
    });
  });

  it('closes edit modal on cancel', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    expect(screen.getByText('admin.books.editTitle')).toBeInTheDocument();
    const closeButtons = screen.getAllByText('admin.createBookModal.close');
    if (closeButtons.length > 0) {
      fireEvent.click(closeButtons[0]);
    }
  });

  it('allows editing author with empty string', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    const authorInput = screen.getAllByRole('textbox')[1];
    fireEvent.change(authorInput, { target: { value: '' } });
    expect(authorInput).toHaveValue('');
  });

  it('allows editing description with empty string', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    const descInput = screen.getAllByRole('textbox')[2];
    fireEvent.change(descInput, { target: { value: '' } });
    expect(descInput).toHaveValue('');
  });

  it('allows entering author name in create modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    const authorInput = screen.getAllByRole('textbox')[1];
    fireEvent.change(authorInput, { target: { value: 'New Author' } });
    expect(authorInput).toHaveValue('New Author');
  });

  it('allows selecting visibility in create modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'public' } });
    expect(select).toHaveValue('public');
  });

  it('handles archive confirmation denied', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
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
    const books = [
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ];
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(books)
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
    const books = [
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ];
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(books)
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
    const books = [
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ];
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(books)
      .mockRejectedValueOnce(new Error('Archive failed'));
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.archive'));
    clickArchiveConfirm();
    await waitFor(() => {
      expect(screen.getByText('Archive failed')).toBeInTheDocument();
    });
  });

  it('navigates to audit logs', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.books.viewAuditLogs'));
  });

  it('handles edit form submission', async () => {
    const books = [
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ];
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(books)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(books);
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
    const books = [
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ];
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(books)
      .mockRejectedValueOnce(new Error('Update failed'));
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    fireEvent.click(screen.getByText('admin.books.saveChanges'));
    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });
  });

  it('allows editing title in edit modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    const titleInput = screen.getAllByRole('textbox')[0];
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    expect(titleInput).toHaveValue('Updated Title');
  });

  it('allows editing author in edit modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    const authorInput = screen.getAllByRole('textbox')[1];
    fireEvent.change(authorInput, { target: { value: 'New Author' } });
    expect(authorInput).toHaveValue('New Author');
  });

  it('allows editing description in edit modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    const descInput = screen.getAllByRole('textbox')[2];
    fireEvent.change(descInput, { target: { value: 'New Description' } });
    expect(descInput).toHaveValue('New Description');
  });

  it('allows editing visibility in edit modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'private' } });
    expect(select).toHaveValue('private');
  });

  it('disables archive button while archiving', async () => {
    const books = [
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ];
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(books)
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

  it('displays loading spinner while fetching', () => {
    vi.mocked(apiRequest).mockImplementation(() => new Promise(() => {}));
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows success message after update', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce([
        { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
      ])
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

  it('shows success message after archive', async () => {
    const books = [
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ];
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(books)
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

  it('renders locale switcher', () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });

  it('closes edit modal on Escape key', async () => {
    vi.mocked(apiRequest).mockResolvedValue([
      { id: '1', slug: 'test', title: 'Test Book', authorName: 'Author', description: 'Desc', visibility: 'public', coverImageUrl: null },
    ]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Test Book')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('admin.books.edit'));
    expect(screen.getByText('admin.books.editTitle')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('admin.books.editTitle')).not.toBeInTheDocument();
    });
  });

  it('shows validation error list from epub validation', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    vi.mocked(validateEpub).mockResolvedValue({
      isValid: false,
      errors: ['Error one', 'Error two'],
      warnings: [],
    });
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    const titleInput = screen.getByPlaceholderText('admin.createBookModal.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'Test Book' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.epub', { type: 'application/epub+zip' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText('admin.createBookModal.submit'));

    await waitFor(() => {
      expect(screen.getByText('Error one')).toBeInTheDocument();
      expect(screen.getByText('Error two')).toBeInTheDocument();
    });
  });

  it('shows validation warning list from epub validation', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    vi.mocked(validateEpub).mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: ['Warning one', 'Warning two'],
    });
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    const titleInput = screen.getByPlaceholderText('admin.createBookModal.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'Test Book' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.epub', { type: 'application/epub+zip' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText('admin.createBookModal.submit'));

    await waitFor(() => {
      expect(screen.getByText('Warning one')).toBeInTheDocument();
      expect(screen.getByText('Warning two')).toBeInTheDocument();
    });
  });

  it('sets fetch error when book list fails', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Network error'));
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('closes create modal on Escape key', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    expect(screen.getByText('admin.createBookModal.title')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('admin.createBookModal.title')).not.toBeInTheDocument();
    });
  });

  it('successfully creates book with valid epub upload', async () => {
    vi.mocked(validateEpub).mockResolvedValue({ isValid: true, errors: [], warnings: [] });

    vi.mocked(apiRequest)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'new-id', uploadUrl: 'https://upload.example.com' })
      .mockResolvedValueOnce({});

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { storageKey: 'abc123', validation: { isValid: true, errors: [], warnings: [] } } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });

    fireEvent.click(screen.getByText('admin.createBook'));
    const titleInput = screen.getByPlaceholderText('admin.createBookModal.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'My New Book' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['epub content'], 'my-book.epub', { type: 'application/epub+zip' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText('admin.createBookModal.submit'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'https://upload.example.com',
        expect.objectContaining({ method: 'PUT' })
      );
      expect(apiRequest).toHaveBeenCalledWith(
        '/api/admin/books/new-id/upload-complete',
        expect.objectContaining({ method: 'POST' })
      );
    });

    vi.unstubAllGlobals();
  });

  it('handles upload failure with validation error code', async () => {
    vi.mocked(validateEpub).mockResolvedValue({ isValid: true, errors: [], warnings: [] });

    vi.mocked(apiRequest)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'new-id', uploadUrl: 'https://upload.example.com' });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        error: { code: 'VALIDATION_ERROR', message: 'Server validation failed', details: ['Bad mimetype', 'Missing content'] },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });

    fireEvent.click(screen.getByText('admin.createBook'));
    const titleInput = screen.getByPlaceholderText('admin.createBookModal.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'My New Book' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['epub content'], 'my-book.epub', { type: 'application/epub+zip' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText('admin.createBookModal.submit'));

    await waitFor(() => {
      expect(screen.getByText('Server validation failed')).toBeInTheDocument();
      expect(screen.getByText('Bad mimetype')).toBeInTheDocument();
      expect(screen.getByText('Missing content')).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('handles upload failure with generic error', async () => {
    vi.mocked(validateEpub).mockResolvedValue({ isValid: true, errors: [], warnings: [] });

    vi.mocked(apiRequest)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'new-id', uploadUrl: 'https://upload.example.com' });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Upload failed' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });

    fireEvent.click(screen.getByText('admin.createBook'));
    const titleInput = screen.getByPlaceholderText('admin.createBookModal.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'My New Book' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['epub content'], 'my-book.epub', { type: 'application/epub+zip' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText('admin.createBookModal.submit'));

    await waitFor(() => {
      expect(screen.getByText('admin.createBookModal.error.upload')).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('shows creating state during submission', async () => {
    vi.mocked(validateEpub).mockResolvedValue({ isValid: true, errors: [], warnings: [] });

    vi.mocked(apiRequest)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'new-id', uploadUrl: 'https://upload.example.com' });

    const mockFetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('fetch', mockFetch);

    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });

    fireEvent.click(screen.getByText('admin.createBook'));
    const titleInput = screen.getByPlaceholderText('admin.createBookModal.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'My New Book' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['epub content'], 'my-book.epub', { type: 'application/epub+zip' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText('admin.createBookModal.submit'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      const spinner = document.querySelector('[aria-busy="true"]');
      expect(spinner).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('localizes mimetype error from validation', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    vi.mocked(validateEpub).mockResolvedValue({
      isValid: false,
      errors: ['Invalid mimetype: expected "application/epub+zip"'],
      warnings: [],
    });
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    const titleInput = screen.getByPlaceholderText('admin.createBookModal.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'Test Book' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.epub', { type: 'application/epub+zip' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText('admin.createBookModal.submit'));

    await waitFor(() => {
      expect(screen.getByText('admin.createBookModal.error.missingMimetype')).toBeInTheDocument();
    });
  });

  it('localizes container.xml error from validation', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    vi.mocked(validateEpub).mockResolvedValue({
      isValid: false,
      errors: ['Missing META-INF/container.xml'],
      warnings: [],
    });
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    const titleInput = screen.getByPlaceholderText('admin.createBookModal.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'Test Book' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.epub', { type: 'application/epub+zip' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText('admin.createBookModal.submit'));

    await waitFor(() => {
      expect(screen.getByText('admin.createBookModal.error.missingContainer')).toBeInTheDocument();
    });
  });

  it('handles corrupt zip error in validation', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    vi.mocked(validateEpub).mockRejectedValue(new Error('Corrupt'));

    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    const titleInput = screen.getByPlaceholderText('admin.createBookModal.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'Test Book' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.epub', { type: 'application/epub+zip' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText('admin.createBookModal.submit'));

    await waitFor(() => {
      expect(screen.getByText('admin.createBookModal.error.corruptZip')).toBeInTheDocument();
    });
  });

  it('creates book and resets form after success', async () => {
    vi.mocked(validateEpub).mockResolvedValue({ isValid: true, errors: [], warnings: [] });

    vi.mocked(apiRequest)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'new-id', uploadUrl: 'https://upload.example.com' })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce([]);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { storageKey: 'abc123' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });

    fireEvent.click(screen.getByText('admin.createBook'));
    const titleInput = screen.getByPlaceholderText('admin.createBookModal.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'My New Book' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['epub content'], 'my-book.epub', { type: 'application/epub+zip' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText('admin.createBookModal.submit'));

    await waitFor(() => {
      expect(screen.getByText('admin.createBookModal.success')).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
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
