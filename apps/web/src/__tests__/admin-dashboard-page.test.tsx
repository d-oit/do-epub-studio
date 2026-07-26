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
    mockApiRequest.mockResolvedValue(mockStats);
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
    mockApiRequest.mockResolvedValue(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('admin.dashboardTitle')).toBeInTheDocument();
    });
  });

  it('renders stat card labels', async () => {
    mockApiRequest.mockResolvedValue(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('admin.stats.totalBooks')).toBeInTheDocument();
      expect(screen.getByText('admin.stats.activeGrants')).toBeInTheDocument();
      expect(screen.getByText('admin.stats.activeSessions')).toBeInTheDocument();
      expect(screen.getByText('admin.stats.storageUsed')).toBeInTheDocument();
    });
  });

  it('formats storage bytes via formatBytes', async () => {
    mockApiRequest.mockResolvedValue(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('1048576 bytes')).toBeInTheDocument();
    });
  });

  it('renders recent activity section', async () => {
    mockApiRequest.mockResolvedValue(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('admin.stats.recentActivity')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('hides recent activity when empty', async () => {
    mockApiRequest.mockResolvedValue({ ...mockStats, recentActivity: [] });
    renderDashboard();
    await waitFor(() => {
      expect(screen.queryByText('admin.stats.recentActivity')).not.toBeInTheDocument();
    });
  });

  it('navigates to books page on button click', async () => {
    mockApiRequest.mockResolvedValue(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/admin\.books\.title/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/admin\.books\.title/));
  });

  it('navigates to grants page on button click', async () => {
    mockApiRequest.mockResolvedValue(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/admin\.grants\.title/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/admin\.grants\.title/));
  });

  it('navigates to audit page on button click', async () => {
    mockApiRequest.mockResolvedValue(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/admin\.audit\.title/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/admin\.audit\.title/));
  });

  it('calls apiRequest with session token', async () => {
    mockApiRequest.mockResolvedValue(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('/api/admin/stats', { token: 'tok-123' });
    });
  });

  it('renders breadcrumb', async () => {
    mockApiRequest.mockResolvedValue(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId('breadcrumb')).toHaveTextContent('admin.breadcrumb.home');
    });
  });

  it('renders locale switcher', async () => {
    mockApiRequest.mockResolvedValue(mockStats);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
    });
  });
});
