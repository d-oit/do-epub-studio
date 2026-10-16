import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminBookResponsesPage } from './BooksPage';
import { apiRequest } from '../../lib/api';
import { validateEpub } from '@do-epub-studio/shared/src/epub-validator';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@do-epub-studio/shared/src/epub-validator', () => ({
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

const mockBooks = [
  {
    id: 'book-1',
    title: 'Design Systems in Practice',
    authorName: 'Ada Lovelace',
    description: 'A foundational guide',
    visibility: 'private',
    slug: 'design-systems',
  },
];

describe('AdminBookResponsesPage — upload revision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload revision button on each book card', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockBooks);
    render(
      <MemoryRouter>
        <AdminBookResponsesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Design Systems in Practice')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'admin.books.uploadRevision' })).toBeInTheDocument();
  });

  it('opens and closes revision upload modal', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockBooks);
    render(
      <MemoryRouter>
        <AdminBookResponsesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'admin.books.uploadRevision' }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'admin.books.uploadRevision' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'annotation.cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('uploads revision, migrates annotations, and displays success notification', async () => {
    const user = userEvent.setup();
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(mockBooks) // initial fetch
      .mockResolvedValueOnce({ id: 'new-revision-file-id' }) // finalize upload-complete
      .mockResolvedValueOnce({ totalCount: 2, migratedCount: 2, orphanedCount: 0 }) // migrate
      .mockResolvedValueOnce(mockBooks); // refresh

    vi.mocked(validateEpub).mockResolvedValue({ isValid: true, errors: [], warnings: [] });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            storageKey: 'books/book-1/rev2.epub',
            validation: { isValid: true, errors: [], warnings: [] },
          },
        }),
    });

    render(
      <MemoryRouter>
        <AdminBookResponsesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'admin.books.uploadRevision' }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'admin.books.uploadRevision' }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['mock content'], 'rev2.epub', { type: 'application/epub+zip' });
    await user.upload(fileInput, testFile);

    const submitButtons = screen.getAllByRole('button', { name: 'admin.books.uploadRevision' });
    const modalSubmitBtn = submitButtons[submitButtons.length - 1];
    expect(modalSubmitBtn).toBeDefined();
    if (modalSubmitBtn) {
      fireEvent.click(modalSubmitBtn);
    }

    await waitFor(() => {
      expect(screen.getByText('admin.books.revisionSuccess')).toBeInTheDocument();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/books/book-1/upload',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
