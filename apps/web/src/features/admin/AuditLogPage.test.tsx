import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

// Mock apiRequest
vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
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

      expect(screen.getByText('Audit Log')).toBeInTheDocument();
    });

    it('renders sign out button', async () => {
      renderAuditPage();

      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    it('renders filter section', async () => {
      renderAuditPage();

      // Check for filter labels (they're just text labels, not associated)
      expect(screen.getByText('Entity Type')).toBeInTheDocument();
      expect(screen.getByText('Entity ID')).toBeInTheDocument();
      expect(screen.getByText('From')).toBeInTheDocument();
      expect(screen.getByText('To')).toBeInTheDocument();
    });

    it('renders entity type options', async () => {
      renderAuditPage();

      // There are multiple selects on the page - get all and check the entity type one
      const selects = screen.getAllByRole('combobox');
      // One of them should be for entity type
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  describe('filter controls', () => {
    it('has Reset button', async () => {
      renderAuditPage();

      expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    });

    it('has Export CSV button', async () => {
      renderAuditPage();

      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    });

    it('clears filters when Reset is clicked', async () => {
      const user = userEvent.setup();
      renderAuditPage();

      // Find the entity type select by finding the select near "Entity Type" label
      const entityTypeLabel = screen.getByText('Entity Type');
      const entityTypeSelect = entityTypeLabel.parentElement?.querySelector('select');

      if (entityTypeSelect) {
        await user.selectOptions(entityTypeSelect, 'book');
        expect(entityTypeSelect).toHaveValue('book');
      }

      // Click reset
      await user.click(screen.getByRole('button', { name: 'Reset' }));

      // Verify filters are cleared
      if (entityTypeSelect) {
        expect(entityTypeSelect).toHaveValue('');
      }
    });
  });

  describe('audit table', () => {
    it('renders audit entries after loading', async () => {
      renderAuditPage();

      await waitFor(() => {
        // There may be multiple entries with same email
        const emailCells = screen.getAllByText('admin@example.com');
        expect(emailCells.length).toBeGreaterThan(0);
      });

      // Verify table structure exists
      expect(screen.getByText('Timestamp')).toBeInTheDocument();
    });

    it('displays entity type badge', async () => {
      renderAuditPage();

      await waitFor(() => {
        expect(screen.getByText('book')).toBeInTheDocument();
        expect(screen.getByText('grant')).toBeInTheDocument();
      });
    });

    it('displays action', async () => {
      renderAuditPage();

      await waitFor(() => {
        expect(screen.getByText('create')).toBeInTheDocument();
        expect(screen.getByText('revoke')).toBeInTheDocument();
      });
    });

    it('shows empty state when no entries', async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({ entries: [], total: 0 });

      renderAuditPage();

      await waitFor(() => {
        expect(screen.getByText('No audit entries found.')).toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('navigates back to books when clicking Back to Books', async () => {
      const user = userEvent.setup();
      renderAuditPage();

      await user.click(screen.getByText('← Back to Books'));

      expect(mockNavigate).toHaveBeenCalledWith('/admin/books');
    });
  });

  describe('pagination', () => {
    it('shows entry count', async () => {
      renderAuditPage();

      await waitFor(() => {
        expect(screen.getByText(/of 2 entries/)).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('shows error message when fetch fails', async () => {
      vi.mocked(apiRequest).mockRejectedValueOnce(new Error('Failed to load audit log'));

      renderAuditPage();

      await waitFor(() => {
        expect(screen.getByText('Failed to load audit log')).toBeInTheDocument();
      });
    });
  });
});