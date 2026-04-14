import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

// Mock apiRequest - default returns empty array to avoid undefined errors
vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn().mockResolvedValue([]),
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
    // Clear mock call history but keep the implementation
    vi.mocked(apiRequest).mockClear();
    // Ensure mock returns books (overrides default empty array)
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

      // Wait for loading to complete by finding book content
      await screen.findByText('Book One');

      // Page uses admin.yourBooks, not admin.dashboardTitle
      expect(screen.getByText('admin.yourBooks')).toBeInTheDocument();
    });

    it('renders navigation links', async () => {
      renderBooksPage();

      await screen.findByText('Book One');

      expect(screen.getByText('Books')).toBeInTheDocument();
      expect(screen.getByText('Access Grants')).toBeInTheDocument();
      expect(screen.getByText('Audit Log')).toBeInTheDocument();
    });

    it('renders create book button', async () => {
      renderBooksPage();

      await screen.findByText('Book One');

      expect(screen.getByText('admin.createBook')).toBeInTheDocument();
    });

    it('renders sign out button', async () => {
      renderBooksPage();

      await screen.findByText('Book One');

      // The sign out button has aria-label="Sign out"
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    });

    it('shows admin email in header', async () => {
      renderBooksPage();

      await screen.findByText('Book One');

      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    });
  });

  describe('book list', () => {
    it('renders books after loading', async () => {
      renderBooksPage();

      await screen.findByText('Book One');
      await screen.findByText('Book Two');
    });

    it('shows author name', async () => {
      renderBooksPage();

      await screen.findByText('Author One');
      await screen.findByText('Author Two');
    });

    it('shows visibility badge', async () => {
      renderBooksPage();

      // Wait for books to load first
      await screen.findByText('Book One');

      // Now check for visibility badges - they should be visible after books load
      await screen.findByText('private');
      await screen.findByText('public');
    });

    it('shows empty state when no books', async () => {
      // Override the mock to return empty array for this test
      // Set mock BEFORE render to avoid race condition
      vi.mocked(apiRequest).mockReset();
      vi.mocked(apiRequest).mockResolvedValue([]);

      renderBooksPage();

      // First wait for loading skeleton to disappear (loading finished)
      await waitFor(() => {
        expect(screen.queryByText('Book One')).not.toBeInTheDocument();
      });

      // Now empty state should be visible
      await screen.findByText('admin.noBooks');
    });
  });

  describe('navigation', () => {
    it('navigates to grants when clicking Access Grants', async () => {
      renderBooksPage();

      // Wait for books to load before interacting
      await screen.findByText('Book One');

      const user = userEvent.setup();
      await user.click(screen.getByText('Access Grants'));

      expect(mockNavigate).toHaveBeenCalledWith('/admin/grants');
    });

    it('navigates to audit when clicking Audit Log', async () => {
      renderBooksPage();

      await screen.findByText('Book One');

      const user = userEvent.setup();
      await user.click(screen.getByText('Audit Log'));

      expect(mockNavigate).toHaveBeenCalledWith('/admin/audit');
    });

    it('navigates to read page when clicking read button', async () => {
      renderBooksPage();

      await screen.findByText('Book One');
      const readButtons = await screen.findAllByText('admin.read');

      const user = userEvent.setup();
      await user.click(readButtons[0]);

      expect(mockNavigate).toHaveBeenCalled();
    });

    it('navigates to grants for book when clicking manage grants', async () => {
      renderBooksPage();

      await screen.findByText('Book One');
      const grantsButtons = await screen.findAllByText('admin.manageGrants');

      const user = userEvent.setup();
      await user.click(grantsButtons[0]);

      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('create book modal', () => {
    it('opens create modal when clicking create button', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await screen.findByText('Book One');
      await user.click(screen.getByText('admin.createBook'));

      await screen.findByText('Title *');
    });

    it('modal has title input', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await screen.findByText('Book One');
      await user.click(screen.getByText('admin.createBook'));

      await screen.findByText('Title *');
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('modal has author input', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await screen.findByText('Book One');
      await user.click(screen.getByText('admin.createBook'));

      await screen.findByText('Author');
    });

    it('modal has visibility dropdown', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await screen.findByText('Book One');
      await user.click(screen.getByText('admin.createBook'));

      await screen.findByText('Visibility');
    });

    it('modal has file input', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await screen.findByText('Book One');
      await user.click(screen.getByText('admin.createBook'));

      await screen.findByText('EPUB File *');
    });

    it('closes modal when clicking cancel', async () => {
      const user = userEvent.setup();
      renderBooksPage();

      await screen.findByText('Book One');
      await user.click(screen.getByText('admin.createBook'));

      await screen.findByText('Cancel');
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

      await screen.findByText('Failed to load books');
    });
  });
});