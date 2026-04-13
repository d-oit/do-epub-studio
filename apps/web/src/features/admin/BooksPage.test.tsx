import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminBooksPage } from './BooksPage';
import { BrowserRouter } from 'react-router-dom';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useTranslation hook
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock apiRequest
vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

// Mock useAuthStore
vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    sessionToken: 'test-token',
    email: 'admin@example.com',
    logout: vi.fn(),
  }),
}));

import { apiRequest } from '../../lib/api';

const mockBooks = [
  {
    id: 'book-1',
    slug: 'book-one',
    title: 'Book One',
    authorName: 'Author One',
    visibility: 'private',
    coverImageUrl: null,
  },
  {
    id: 'book-2',
    slug: 'book-two',
    title: 'Book Two',
    authorName: 'Author Two',
    visibility: 'public',
    coverImageUrl: 'https://example.com/cover.jpg',
  },
];

describe('AdminBooksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiRequest).mockResolvedValue(mockBooks);
  });

  const renderBooksPage = () => {
    return render(
      <BrowserRouter>
        <AdminBooksPage />
      </BrowserRouter>,
    );
  };

  describe('rendering', () => {
    it('renders page title', async () => {
      renderBooksPage();

      expect(screen.getByText('admin.dashboardTitle')).toBeInTheDocument();
    });

    it('renders navigation links', async () => {
      renderBooksPage();

      expect(screen.getByText('Books')).toBeInTheDocument();
      expect(screen.getByText('Access Grants')).toBeInTheDocument();
      expect(screen.getByText('Audit Log')).toBeInTheDocument();
    });

    it('renders create book button', async () => {
      renderBooksPage();

      expect(screen.getByText('admin.createBook')).toBeInTheDocument();
    });

    it('renders sign out button', async () => {
      renderBooksPage();

      expect(screen.getByText('admin.userMenu.signOut')).toBeInTheDocument();
    });

    it('shows admin email in header', async () => {
      renderBooksPage();

      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    });
  });

  describe('book list', () => {
    it('renders books after loading', async () => {
      renderBooksPage();

      await waitFor(() => {
        expect(screen.getByText('Book One')).toBeInTheDocument();
        expect(screen.getByText('Book Two')).toBeInTheDocument();
      });
    });

    it('shows author name', async () => {
      renderBooksPage();

      await waitFor(() => {
        expect(screen.getByText('Author One')).toBeInTheDocument();
        expect(screen.getByText('Author Two')).toBeInTheDocument();
      });
    });

    it('shows visibility badge', async () => {
      renderBooksPage();

      await waitFor(() => {
        expect(screen.getByText('private')).toBeInTheDocument();
        expect(screen.getByText('public')).toBeInTheDocument();
      });
    });

    it('shows empty state when no books', async () => {
      // Clear any previous mock and set empty array response
      vi.mocked(apiRequest).mockReset();
      vi.mocked(apiRequest).mockResolvedValueOnce([]);

      renderBooksPage();

      // Wait for loading to complete and empty state to appear
      await waitFor(
        () => {
          expect(screen.getByText('admin.noBooks')).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });
  });

  describe('navigation', () => {
    it('navigates to grants when clicking Access Grants', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await user.click(screen.getByText('Access Grants'));

      expect(mockNavigate).toHaveBeenCalledWith('/admin/grants');
    });

    it('navigates to audit when clicking Audit Log', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await user.click(screen.getByText('Audit Log'));

      expect(mockNavigate).toHaveBeenCalledWith('/admin/audit');
    });

    it('navigates to read page when clicking read button', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await waitFor(() => {
        expect(screen.getAllByText('admin.read').length).toBeGreaterThan(0);
      });

      const readButtons = screen.getAllByText('admin.read');
      await user.click(readButtons[0]);

      expect(mockNavigate).toHaveBeenCalled();
    });

    it('navigates to grants for book when clicking manage grants', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await waitFor(() => {
        expect(screen.getAllByText('admin.manageGrants').length).toBeGreaterThan(0);
      });

      const grantsButtons = screen.getAllByText('admin.manageGrants');
      await user.click(grantsButtons[0]);

      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('create book modal', () => {
    it('opens create modal when clicking create button', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await user.click(screen.getByText('admin.createBook'));

      // Modal opens - look for the modal content
      await waitFor(() => {
        expect(screen.getByText('Title *')).toBeInTheDocument();
      });
    });

    it('modal has title input', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await user.click(screen.getByText('admin.createBook'));

      await waitFor(() => {
        // Find the input by its placeholder or by finding inputs near the label
        const inputs = screen.getAllByRole('textbox');
        expect(inputs.length).toBeGreaterThan(0);
      });
    });

    it('modal has author input', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await user.click(screen.getByText('admin.createBook'));

      await waitFor(() => {
        expect(screen.getByText('Author')).toBeInTheDocument();
      });
    });

    it('modal has visibility dropdown', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await user.click(screen.getByText('admin.createBook'));

      await waitFor(() => {
        expect(screen.getByText('Visibility')).toBeInTheDocument();
      });
    });

    it('modal has file input', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await user.click(screen.getByText('admin.createBook'));

      await waitFor(() => {
        expect(screen.getByText('EPUB File *')).toBeInTheDocument();
      });
    });

    it('closes modal when clicking cancel', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await user.click(screen.getByText('admin.createBook'));

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Title *')).not.toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('shows error message when fetch fails', async () => {
      vi.mocked(apiRequest).mockRejectedValueOnce(new Error('Failed to load books'));

      renderBooksPage();

      await waitFor(() => {
        expect(screen.getByText('Failed to load books')).toBeInTheDocument();
      });
    });
  });
});