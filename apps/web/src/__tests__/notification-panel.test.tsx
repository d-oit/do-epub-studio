import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationPanel } from '../features/reader/components/notifications/NotificationPanel';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

const t = vi.fn((key: string) => key);
const onNavigateToComment = vi.fn();
const onClose = vi.fn();

const mockNotifications = [
  { id: 'n1', bookId: 'b1', commentId: 'c1', parentCommentId: null, type: 'reply', message: 'Alice replied to your comment', readAt: null, createdAt: '2026-07-20T10:00:00Z' },
  { id: 'n2', bookId: 'b1', commentId: 'c2', parentCommentId: null, type: 'reply', message: 'Bob replied', readAt: '2026-07-21T10:00:00Z', createdAt: '2026-07-19T10:00:00Z' },
];

describe('NotificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/notifications?limit=20') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: { notifications: mockNotifications, total: 2, limit: 20, offset: 0 } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('renders dialog with accessible label', () => {
    render(<NotificationPanel t={t} onNavigateToComment={onNavigateToComment} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'notifications.title' })).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<NotificationPanel t={t} onNavigateToComment={onNavigateToComment} onClose={onClose} />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('shows empty state when no notifications', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/notifications?limit=20') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: { notifications: [], total: 0, limit: 20, offset: 0 } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(<NotificationPanel t={t} onNavigateToComment={onNavigateToComment} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('notifications.empty')).toBeInTheDocument();
    });
  });

  it('renders notification messages', async () => {
    render(<NotificationPanel t={t} onNavigateToComment={onNavigateToComment} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Alice replied to your comment')).toBeInTheDocument();
      expect(screen.getByText('Bob replied')).toBeInTheDocument();
    });
  });

  it('shows mark all read button when unread notifications exist', async () => {
    render(<NotificationPanel t={t} onNavigateToComment={onNavigateToComment} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('notifications.markAllRead')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    render(<NotificationPanel t={t} onNavigateToComment={onNavigateToComment} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'common.close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('navigates to comment when notification clicked', async () => {
    const user = userEvent.setup();
    render(<NotificationPanel t={t} onNavigateToComment={onNavigateToComment} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('Alice replied to your comment')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Alice replied to your comment'));
    expect(onNavigateToComment).toHaveBeenCalledWith('b1', 'c1');
  });
});
