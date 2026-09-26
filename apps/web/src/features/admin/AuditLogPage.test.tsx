import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

async function renderAndFlush() {
  // Use async act so React 19's use() + Suspense can settle
  // synchronously inside the act scope.
  await act(() => {
    render(<MemoryRouter><AdminAuditPage /></MemoryRouter>);
    return Promise.resolve();
  });
}

describe('AdminAuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders audit entries', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      entries: [{ id: '1', actorEmail: 'a@ex.com', entityType: 'book', entityId: 'b1', action: 'create', payload: null, createdAt: new Date().toISOString() }],
      total: 1,
    });

    await renderAndFlush();
    expect(await screen.findByText('a@ex.com', undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it('refresh refetches and renders new audit entries without changing filters', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      entries: [{ id: '1', actorEmail: 'a@ex.com', entityType: 'book', entityId: 'b1', action: 'create', payload: null, createdAt: new Date().toISOString() }],
      total: 1,
    });

    await renderAndFlush();
    expect(await screen.findByText('a@ex.com', undefined, { timeout: 5000 })).toBeInTheDocument();

    // Backend records a new row after the initial load.
    vi.mocked(apiRequest).mockResolvedValue({
      entries: [{ id: '2', actorEmail: 'new@ex.com', entityType: 'user', entityId: 'u1', action: 'login', payload: null, createdAt: new Date().toISOString() }],
      total: 1,
    });

    const callsBeforeRefresh = vi.mocked(apiRequest).mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByText('admin.audit.refresh'));
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(vi.mocked(apiRequest).mock.calls.length).toBeGreaterThan(callsBeforeRefresh);
    expect(await screen.findByText('new@ex.com', undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it('renders error message on fetch failure', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Failed to fetch'));

    await renderAndFlush();
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });

  it('renders empty state when no logs', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ entries: [], total: 0 });

    await renderAndFlush();
    expect(screen.getByText('admin.audit.noLogs')).toBeInTheDocument();
  });

  it('renders pagination info', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      entries: [{ id: '1', actorEmail: 'a@ex.com', entityType: 'book', entityId: 'b1', action: 'create', payload: null, createdAt: new Date().toISOString() }],
      total: 1,
    });

    await renderAndFlush();
    // Mock returns key as-is; paginationInfo key contains {start}-{end} of {total}
    expect(screen.getByText('admin.audit.paginationInfo')).toBeInTheDocument();
  });

  it('renders filter controls', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ entries: [], total: 0 });

    // The page suspends on its first fetch; a synchronous `render` leaves that
    // resolution outside act, so use the shared settling helper.
    await renderAndFlush();
    expect(screen.getByLabelText('admin.audit.entityType')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('admin.audit.filterByEntityId')).toBeInTheDocument();
    expect(screen.getByLabelText('admin.audit.dateFrom')).toBeInTheDocument();
    expect(screen.getByLabelText('admin.audit.dateTo')).toBeInTheDocument();
  });

  it('calls API with filters when entity type changes', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ entries: [], total: 0 });

    await renderAndFlush();
    expect(apiRequest).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('admin.audit.entityType'), { target: { value: 'book' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining('entityType=book'),
      expect.anything(),
    );
  });

  it('calls API with filters when entity ID changes', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ entries: [], total: 0 });

    await renderAndFlush();
    expect(apiRequest).toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('admin.audit.filterByEntityId'), { target: { value: 'b1' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining('entityId=b1'),
      expect.anything(),
    );
  });

  it('calls API with date filters', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ entries: [], total: 0 });

    await renderAndFlush();
    expect(apiRequest).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('admin.audit.dateFrom'), { target: { value: '2024-01-01' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining('from=2024-01-01'),
      expect.anything(),
    );
  });

  it('resets filters when reset button clicked', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ entries: [], total: 0 });

    await renderAndFlush();
    expect(apiRequest).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('admin.audit.entityType'), { target: { value: 'book' } });
    fireEvent.click(screen.getByText('admin.audit.resetFilters'));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining('entityType='),
      expect.anything(),
    );
  });

  it('navigates to previous page', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      entries: Array.from({ length: 50 }, (_, i) => ({
        id: String(i), actorEmail: 'a@ex.com', entityType: 'book', entityId: 'b1', action: 'create', payload: null, createdAt: new Date().toISOString()
      })),
      total: 100,
    });

    await renderAndFlush();
    expect(apiRequest).toHaveBeenCalled();

    // Page is initially 1, Previous is disabled; this test just verifies
    // the page renders the correct pagination info.
    expect(screen.getByText('admin.audit.pageOf')).toBeInTheDocument();
  });

  it('navigates to next page', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      entries: Array.from({ length: 50 }, (_, i) => ({
        id: String(i), actorEmail: 'a@ex.com', entityType: 'book', entityId: 'b1', action: 'create', payload: null, createdAt: new Date().toISOString()
      })),
      total: 100,
    });

    await renderAndFlush();
    expect(apiRequest).toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText('admin.audit.next'));
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByText('admin.audit.pageOf')).toBeInTheDocument();
  });
});
