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

describe('AdminBookResponsesPage — create modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens create modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    expect(screen.getByText('admin.createBookModal.title')).toBeInTheDocument();
  });

  it('closes create modal on cancel', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBookResponsesPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });
    fireEvent.click(screen.getByText('admin.createBook'));
    expect(screen.getByText('admin.createBookModal.title')).toBeInTheDocument();
    fireEvent.click(screen.getByText('admin.createBookModal.close'));
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
});
