import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationBadge } from '../features/reader/components/notifications/NotificationBadge';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const t = (key: string) => key;

describe('NotificationBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, data: { count: 0 } }),
    });
  });

  it('renders bell button with accessible label', () => {
    render(<NotificationBadge t={t} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'notifications.title' })).toBeInTheDocument();
  });

  it('does not show count badge when unread count is 0', async () => {
    render(<NotificationBadge t={t} onClick={() => {}} />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('shows count badge when unread count > 0', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, data: { count: 5 } }),
    });
    render(<NotificationBadge t={t} onClick={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('shows 99+ for counts above 99', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, data: { count: 150 } }),
    });
    render(<NotificationBadge t={t} onClick={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('99+')).toBeInTheDocument();
    });
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<NotificationBadge t={t} onClick={onClick} />);
    await user.click(screen.getByRole('button', { name: 'notifications.title' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('silently fails on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    render(<NotificationBadge t={t} onClick={() => {}} />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('fetches unread count on mount', async () => {
    render(<NotificationBadge t={t} onClick={() => {}} />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/notifications/unread-count');
    });
  });
});
