import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminAuditPage } from './AuditLogPage';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockAuditAuth = { sessionToken: 'token', isAdmin: true, logout: vi.fn() };
vi.mock('../../stores/auth', () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    return selector ? selector(mockAuditAuth) : mockAuditAuth;
  },
}));

import { apiRequest } from '../../lib/api';

describe('AdminAuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders audit entries', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      entries: [{ id: '1', actorEmail: 'a@ex.com', entityType: 'book', entityId: 'b1', action: 'create', payload: null, createdAt: new Date().toISOString() }],
      total: 1,
    });

    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    expect(await screen.findByText('a@ex.com')).toBeInTheDocument();
  });

  it('renders error message on fetch failure', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Failed to fetch'));

    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument();
  });

  it('renders empty state when no logs', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ entries: [], total: 0 });

    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    expect(await screen.findByText('admin.audit.noLogs')).toBeInTheDocument();
  });

  it('renders pagination info', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      entries: [{ id: '1', actorEmail: 'a@ex.com', entityType: 'book', entityId: 'b1', action: 'create', payload: null, createdAt: new Date().toISOString() }],
      total: 1,
    });

    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    expect(await screen.findByText(/1-1 of 1/)).toBeInTheDocument();
  });

  it('renders filter controls', () => {
    vi.mocked(apiRequest).mockResolvedValue({ entries: [], total: 0 });

    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    expect(screen.getByLabelText('Entity Type')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter by entity ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Date From')).toBeInTheDocument();
    expect(screen.getByLabelText('Date To')).toBeInTheDocument();
  });

  it('calls API with filters when entity type changes', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ entries: [], total: 0 });

    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });

    fireEvent.change(screen.getByLabelText('Entity Type'), { target: { value: 'book' } });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining('entityType=book'),
        expect.anything()
      );
    });
  });

  it('calls API with filters when entity ID changes', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ entries: [], total: 0 });

    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });

    fireEvent.change(screen.getByPlaceholderText('Filter by entity ID'), { target: { value: 'b1' } });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining('entityId=b1'),
        expect.anything()
      );
    });
  });

  it('calls API with date filters', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ entries: [], total: 0 });

    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });

    fireEvent.change(screen.getByLabelText('Date From'), { target: { value: '2024-01-01' } });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining('from=2024-01-01'),
        expect.anything()
      );
    });
  });

  it('resets filters when reset button clicked', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ entries: [], total: 0 });

    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });

    fireEvent.change(screen.getByLabelText('Entity Type'), { target: { value: 'book' } });
    fireEvent.click(screen.getByText('Reset Filters'));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining('entityType='),
        expect.anything()
      );
    });
  });

  it('navigates to previous page', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      entries: Array.from({ length: 50 }, (_, i) => ({
        id: String(i), actorEmail: 'a@ex.com', entityType: 'book', entityId: 'b1', action: 'create', payload: null, createdAt: new Date().toISOString()
      })),
      total: 100,
    });

    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });

    fireEvent.click(screen.getByText('Previous'));
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('navigates to next page', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      entries: Array.from({ length: 50 }, (_, i) => ({
        id: String(i), actorEmail: 'a@ex.com', entityType: 'book', entityId: 'b1', action: 'create', payload: null, createdAt: new Date().toISOString()
      })),
      total: 100,
    });

    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    await waitFor(() => { expect(apiRequest).toHaveBeenCalled(); });

    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => {
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });
  });
});
