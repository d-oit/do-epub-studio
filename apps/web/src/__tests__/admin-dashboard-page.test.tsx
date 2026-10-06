import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboardPage } from '../features/admin/AdminDashboardPage';
import { useAuthStore } from '../stores/auth';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../components/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

vi.mock('../components/navigation', () => ({
  Breadcrumb: ({ items }: { items: { labelKey: string }[] }) => (
    <div data-testid="breadcrumb">{items.map((i) => i.labelKey).join(',')}</div>
  ),
}));

vi.mock('@do-epub-studio/ui', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('../lib/formatBytes', () => ({
  formatBytes: (b: number) => `${b} bytes`,
}));

import { apiRequest } from '../lib/api';
const mockApiRequest = vi.mocked(apiRequest);

const mockStats = {
  totalBooks: 12,
  archivedBooks: 3,
  activeGrants: 5,
  activeSessions: 8,
  storageBytes: 1048576,
  recentActivity: [
    { action: 'book.upload', count: 4 },
    { action: 'grant.created', count: 2 },
  ],
};

const mockInsights = [
  {
    bookId: 'book-1',
    totalActiveMinutes: 120,
    totalActivePages: 60,
    readerCount: 3,
    lastActivity: '2026-10-04T10:00:00Z',
  },
  {
    bookId: 'book-2',
    totalActiveMinutes: 45,
    totalActivePages: 20,
    readerCount: 1,
    lastActivity: '2026-10-03T10:00:00Z',
  },
];

/** Route both admin endpoints: stats and aggregate insights. */
function mockApi(stats: unknown = mockStats, insights: unknown = mockInsights) {
  mockApiRequest.mockImplementation((url: string) =>
    Promise.resolve(url.startsWith('/api/admin/insights') ? insights : stats),
  );
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AdminDashboardPage />
    </MemoryRouter>,
  );
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ sessionToken: 'tok-123' });
  });

  it('shows loading spinner initially', () => {
    mockApiRequest.mockImplementation(() => new Promise(() => {}));
    renderDashboard();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders stats after loading', async () => {
    mockApi(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  it('shows error on fetch failure', async () => {
    mockApiRequest.mockRejectedValue(new Error('Network error'));
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('renders dashboard title', async () => {
    mockApi(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('admin.dashboardTitle')).toBeInTheDocument();
    });
  });

  it('renders stat card labels', async () => {
    mockApi(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('admin.stats.totalBooks')).toBeInTheDocument();
      expect(screen.getByText('admin.stats.activeGrants')).toBeInTheDocument();
      expect(screen.getByText('admin.stats.activeSessions')).toBeInTheDocument();
      expect(screen.getByText('admin.stats.storageUsed')).toBeInTheDocument();
    });
  });

  it('formats storage bytes via formatBytes', async () => {
    mockApi(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('1048576 bytes')).toBeInTheDocument();
    });
  });

  it('renders recent activity section', async () => {
    mockApi(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('admin.stats.recentActivity')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('hides recent activity when empty', async () => {
    mockApi({ ...mockStats, recentActivity: [] });
    renderDashboard();
    await waitFor(() => {
      expect(screen.queryByText('admin.stats.recentActivity')).not.toBeInTheDocument();
    });
  });

  it('navigates to books page on button click', async () => {
    mockApi(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/admin\.books\.title/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/admin\.books\.title/));
  });

  it('navigates to grants page on button click', async () => {
    mockApi(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/admin\.grants\.title/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/admin\.grants\.title/));
  });

  it('navigates to audit page on button click', async () => {
    mockApi(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/admin\.audit\.title/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/admin\.audit\.title/));
  });

  it('calls apiRequest with session token', async () => {
    mockApi(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('/api/admin/stats', { token: 'tok-123' });
    });
  });

  it('renders breadcrumb', async () => {
    mockApi(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId('breadcrumb')).toHaveTextContent('admin.breadcrumb.home');
    });
  });

  it('renders locale switcher', async () => {
    mockApi(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
    });
  });

  // N2: book-only aggregate insights
  it('renders aggregate insights for seeded books with no reader identity', async () => {
    mockApi(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('book-1')).toBeInTheDocument();
      expect(screen.getByText('book-2')).toBeInTheDocument();
      // 120 minutes formats as "2h"; 60 pages is the aggregate page total.
      expect(screen.getByText('2h')).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument();
    });
    // No reader email or per-reader timeline is rendered anywhere.
    expect(screen.queryByText(/@example\.com/)).not.toBeInTheDocument();
    expect(screen.queryByText(/timeline/i)).not.toBeInTheDocument();
  });

  it('requests the insights endpoint with limit/offset pagination', async () => {
    mockApi(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('/api/admin/insights?limit=20&offset=0', {
        token: 'tok-123',
      });
    });
  });

  it('next page requests a different offset and renders the different fixture set', async () => {
    const fullFirstPage = [
      ...mockInsights,
      ...Array.from({ length: 18 }, (_, i) => ({
        bookId: `book-fill-${i + 1}`,
        totalActiveMinutes: 10,
        totalActivePages: 5,
        readerCount: 1,
        lastActivity: '2026-10-02T10:00:00Z',
      })),
    ];
    mockApiRequest.mockImplementation((url: string) => {
      if (url.startsWith('/api/admin/insights')) {
        if (url.includes('offset=20')) {
          return Promise.resolve([
            {
              bookId: 'book-3',
              totalActiveMinutes: 10,
              totalActivePages: 5,
              readerCount: 1,
              lastActivity: '2026-10-02T10:00:00Z',
            },
          ]);
        }
        return Promise.resolve(fullFirstPage);
      }
      return Promise.resolve(mockStats);
    });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('book-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'admin.insights.next' }));
    await waitFor(() => {
      expect(screen.getByText('book-3')).toBeInTheDocument();
      expect(screen.queryByText('book-1')).not.toBeInTheDocument();
    });
  });

  it('renders a distinct empty state when no aggregate activity exists', async () => {
    mockApi(mockStats, []);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('admin.insights.empty')).toBeInTheDocument();
    });
  });
});
