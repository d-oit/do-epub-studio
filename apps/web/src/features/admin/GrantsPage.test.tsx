import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrantsPage } from './GrantsPage';
import { BrowserRouter } from 'react-router-dom';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ bookId: undefined }),
  };
});

// Mock useTranslation hook
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock apiRequest - default returns empty to avoid undefined errors
vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn().mockResolvedValue([]),
}));

// Mock useAuthStore
vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    sessionToken: 'test-token',
    email: 'admin@example.com',
    logout: vi.fn(),
    capabilities: { canManageAccess: true },
  }),
}));

import { apiRequest } from '../../lib/api';

const mockBooks = [
  { id: 'book-1', slug: 'book-one', title: 'Book One' },
  { id: 'book-2', slug: 'book-two', title: 'Book Two' },
];

const mockGrants = [
  {
    id: 'grant-1',
    email: 'reader@example.com',
    mode: 'private',
    commentsAllowed: true,
    offlineAllowed: false,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    revokedAt: null,
  },
  {
    id: 'grant-2',
    email: 'editor@example.com',
    mode: 'editorial_review',
    commentsAllowed: true,
    offlineAllowed: true,
    expiresAt: null,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  },
];

describe('GrantsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(apiRequest).mockImplementation(async (url: string) => {
      if (url.includes('/books') && !url.includes('grants')) {
        return mockBooks;
      }
      if (url.includes('grants')) {
        return mockGrants;
      }
      return {};
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderGrantsPage = async () => {
    const result = render(
      <BrowserRouter>
        <GrantsPage />
      </BrowserRouter>,
    );
    // Flush all pending async effects to avoid act() warnings
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    return result;
  };

  describe('rendering', () => {
    it('renders page title', async () => {
      await renderGrantsPage();

      expect(screen.getByText('grants.title')).toBeInTheDocument();
    });

    it('renders sign out button', async () => {
      await renderGrantsPage();

      expect(screen.getByText('admin.userMenu.signOut')).toBeInTheDocument();
    });

    it('renders book selector', async () => {
      await renderGrantsPage();

      expect(screen.getByLabelText('grants.selectBook')).toBeInTheDocument();
    });

    it('shows prompt when no book selected', async () => {
      await renderGrantsPage();

      expect(screen.getByText('grants.selectBookPrompt')).toBeInTheDocument();
    });
  });

  describe('book selector', () => {
    it('populates book options from API', async () => {
      await renderGrantsPage();

      const select = screen.getByLabelText('grants.selectBook');
      expect(within(select).getByText('Book One')).toBeInTheDocument();
      expect(within(select).getByText('Book Two')).toBeInTheDocument();
    });

    it('has "All Books" option', async () => {
      await renderGrantsPage();

      const select = screen.getByLabelText('grants.selectBook');
      expect(within(select).getByText('grants.allBooks')).toBeInTheDocument();
    });
  });

  describe('grants table', () => {
    it('shows grants when book is selected', async () => {
      const user = userEvent.setup({ delay: null });
      await renderGrantsPage();

      await act(async () => {
        await user.selectOptions(screen.getByLabelText('grants.selectBook'), 'book-1');
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('reader@example.com')).toBeInTheDocument();
    });

    it('displays grant email', async () => {
      const user = userEvent.setup({ delay: null });
      await renderGrantsPage();

      await act(async () => {
        await user.selectOptions(screen.getByLabelText('grants.selectBook'), 'book-1');
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('reader@example.com')).toBeInTheDocument();
      expect(screen.getByText('editor@example.com')).toBeInTheDocument();
    });

    it('displays grant mode badge', async () => {
      const user = userEvent.setup({ delay: null });
      await renderGrantsPage();

      await act(async () => {
        await user.selectOptions(screen.getByLabelText('grants.selectBook'), 'book-1');
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('Private')).toBeInTheDocument();
      expect(screen.getByText('Editorial Review')).toBeInTheDocument();
    });

    it('displays capability badges', async () => {
      const user = userEvent.setup({ delay: null });
      await renderGrantsPage();

      await act(async () => {
        await user.selectOptions(screen.getByLabelText('grants.selectBook'), 'book-1');
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('grants.capabilities.comments')).toBeInTheDocument();
      expect(screen.getByText('grants.capabilities.offline')).toBeInTheDocument();
    });

    it('shows empty state when no grants', async () => {
      vi.mocked(apiRequest).mockImplementation(async (url: string) => {
        if (url.includes('/books') && !url.includes('grants')) return mockBooks;
        if (url.includes('grants')) return [];
        return {};
      });

      const user = userEvent.setup({ delay: null });
      await renderGrantsPage();

      await act(async () => {
        await user.selectOptions(screen.getByLabelText('grants.selectBook'), 'book-1');
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('grants.noGrants')).toBeInTheDocument();
    });
  });

  describe('create grant', () => {
    it('shows create button when book selected', async () => {
      const user = userEvent.setup({ delay: null });
      await renderGrantsPage();

      await act(async () => {
        await user.selectOptions(screen.getByLabelText('grants.selectBook'), 'book-1');
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('grants.createGrant')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows error when fetch fails', async () => {
      vi.mocked(apiRequest).mockRejectedValueOnce(new Error('Failed to load'));

      await renderGrantsPage();

      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });
  });
});
