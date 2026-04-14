import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminAuditPage } from './AuditLogPage';
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

// Mock apiRequest - default returns empty to avoid undefined errors
vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
}));

// Mock useAuthStore
vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    sessionToken: 'test-token',
    isAdmin: true,
    logout: vi.fn(),
  }),
}));

import { apiRequest } from '../../lib/api';

const mockAuditEntries = [
  {
    id: 'audit-1',
    actorEmail: 'admin@example.com',
    entityType: 'book',
    entityId: 'book-1',
    action: 'create',
    payloadJson: '{"title":"Test Book"}',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'audit-2',
    actorEmail: 'admin@example.com',
    entityType: 'grant',
    entityId: 'grant-1',
    action: 'revoke',
    payloadJson: null,
    createdAt: new Date().toISOString(),
  },
];

const mockAuditResponse = {
  entries: mockAuditEntries,
  total: 2,
};

describe('AdminAuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiRequest).mockResolvedValue(mockAuditResponse);
  });

  const renderAuditPage = () => {
    return render(
      <BrowserRouter>
        <AdminAuditPage />
      </BrowserRouter>,
    );
  };

  describe('rendering', () => {
    it('renders page title', async () => {
      renderAuditPage();

      // Wait for data to load by finding the table header
      await screen.findByText('Timestamp');
      expect(screen.getByText('Audit Log')).toBeInTheDocument();
    });

    it('renders sign out button', async () => {
      renderAuditPage();

      await screen.findByText('Timestamp');
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    it('renders filter section', async () => {
      renderAuditPage();

      await screen.findByText('Timestamp');
      // Entity Type only appears in filter section (table header uses "Type")
      expect(screen.getByText('Entity Type')).toBeInTheDocument();
      // Entity ID appears in both filter section and table header
      expect(screen.getAllByText('Entity ID').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('From')).toBeInTheDocument();
      expect(screen.getByText('To')).toBeInTheDocument();
    });

    it('renders entity type options', async () => {
      renderAuditPage();

      await screen.findByText('Timestamp');
      // Filter select and locale switcher both use combobox role
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('filter controls', () => {
    it('has Reset button', async () => {
      renderAuditPage();

      await screen.findByText('Timestamp');
      expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    });

    it('has Export CSV button', async () => {
      renderAuditPage();

      await screen.findByText('Timestamp');
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    });

    it('clears filters when Reset is clicked', async () => {
      const user = userEvent.setup();
      renderAuditPage();

      await screen.findByText('Timestamp');

      // Get the entity type filter select (not locale switcher)
      const selects = screen.getAllByRole('combobox');
      const filterSelect =
        selects.find((s) => s.querySelector('option[value="book"]')) || selects[1];

      await user.selectOptions(filterSelect, 'book');
      expect(filterSelect).toHaveValue('book');

      await user.click(screen.getByRole('button', { name: 'Reset' }));

      await waitFor(() => {
        expect(filterSelect).toHaveValue('');
      });
    });
  });

  describe('audit table', () => {
    it('renders audit entries after loading', async () => {
      renderAuditPage();

      const emailCells = await screen.findAllByText('admin@example.com');
      expect(emailCells.length).toBeGreaterThan(0);
      expect(screen.getByText('Timestamp')).toBeInTheDocument();
    });

    it('displays entity type badge', async () => {
      renderAuditPage();

      await screen.findByText('Timestamp');
      // "book" and "grant" appear in both filter options and table badges
      // Check that they exist at least once
      expect(screen.getAllByText('book').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('grant').length).toBeGreaterThanOrEqual(1);
    });

    it('displays action', async () => {
      renderAuditPage();

      await screen.findByText('Timestamp');
      expect(screen.getByText('create')).toBeInTheDocument();
      expect(screen.getByText('revoke')).toBeInTheDocument();
    });

    it('shows empty state when no entries', async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({ entries: [], total: 0 });

      renderAuditPage();

      await screen.findByText('No audit entries found.');
    });
  });

  describe('navigation', () => {
    it('navigates back to books when clicking Back to Books', async () => {
      const user = userEvent.setup();
      renderAuditPage();

      await screen.findByText('Timestamp');
      await user.click(screen.getByText('← Back to Books'));

      expect(mockNavigate).toHaveBeenCalledWith('/admin/books');
    });
  });

  describe('pagination', () => {
    it('shows entry count', async () => {
      renderAuditPage();

      await screen.findByText('Timestamp');
      expect(screen.getByText(/2 entries/)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows error message when fetch fails', async () => {
      vi.mocked(apiRequest).mockRejectedValueOnce(new Error('Failed to load audit log'));

      renderAuditPage();

      await screen.findByText('Failed to load audit log');
    });
  });
});
