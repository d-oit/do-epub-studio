import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationBadge } from '../features/reader/components/notifications/NotificationBadge';
import { useAuthStore } from '../stores/auth';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const t = vi.fn((key: string) => key);

describe('NotificationBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ sessionToken: 'test-badge-token', bookId: 'b1' });
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/notifications/unread-count')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: { count: 0 } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  afterEach(() => {
    act(() => {
      useAuthStore.setState({ sessionToken: null, bookId: null });
    });
  });
  const renderBadge = async (props: { onClick?: () => void } = {}): Promise<RenderResult> => {
    const view = render(<NotificationBadge t={t} onClick={props.onClick ?? (() => {})} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'notifications.title' })).toHaveAttribute(
        'data-loaded',
        'true',
      );
    });
    return view;
  };

  it('renders bell button with accessible label', async () => {
    await renderBadge();
    expect(screen.getByRole('button', { name: 'notifications.title' })).toBeInTheDocument();
  });

  it('does not show count badge when unread count is 0', async () => {
    await renderBadge();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows count badge when unread count > 0', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/notifications/unread-count')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: { count: 5 } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    await renderBadge();
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('shows 99+ for counts above 99', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/notifications/unread-count')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: { count: 150 } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    await renderBadge();
    await waitFor(() => {
      expect(screen.getByText('99+')).toBeInTheDocument();
    });
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    await renderBadge({ onClick });
    const button = screen.getByRole('button', { name: 'notifications.title' });
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('silently fails on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    await renderBadge();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('fetches unread count on mount with auth bearer', async () => {
    await renderBadge();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/notifications/unread-count'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-badge-token',
        }),
      }),
    );
  });
});
