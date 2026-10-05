import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationBadge } from '../features/reader/components/notifications/NotificationBadge';
import { NotificationPanel } from '../features/reader/components/notifications/NotificationPanel';
import { useAuthStore } from '../stores/auth';

const TEST_SESSION_TOKEN = 'valid-test-session-token-123';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

const t = vi.fn((key: string) => key);
const onNavigateToComment = vi.fn();
const onClose = vi.fn();

const mockNotifications = [
  {
    id: 'notif-1',
    bookId: 'book-test',
    commentId: 'comment-1',
    parentCommentId: null,
    type: 'reply',
    message: 'Reviewer replied to your note',
    readAt: null,
    createdAt: '2026-07-20T10:00:00Z',
  },
];

describe('Notifications Auth-Header Enforcement (M2 Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ sessionToken: TEST_SESSION_TOKEN, bookId: 'book-test' });

    // Auth-enforcing mock: requires exact Authorization Bearer header, returns 401 otherwise
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const headers = (init?.headers as Record<string, string>) || {};
      const authHeader = headers['Authorization'] || headers['authorization'];

      if (!authHeader || authHeader !== `Bearer ${TEST_SESSION_TOKEN}`) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () =>
            Promise.resolve({ ok: false, error: 'Unauthorized: missing or invalid bearer token' }),
        });
      }

      if (url.includes('/api/notifications/unread-count')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true, data: { count: 3 } }),
        });
      }

      if (url.includes('/api/notifications?limit=')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ok: true,
              data: { notifications: mockNotifications, total: 1, limit: 20, offset: 0 },
            }),
        });
      }

      if (url.includes('/read')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true }),
        });
      }

      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });
  });

  describe('NotificationBadge', () => {
    it('sends Authorization bearer header when authenticated and displays count', async () => {
      render(<NotificationBadge t={t} onClick={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/unread-count'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${TEST_SESSION_TOKEN}`,
          }),
        }),
      );
    });

    it('does not send any request when unauthenticated (avoids 401 logout trigger)', async () => {
      useAuthStore.setState({ sessionToken: null });
      render(<NotificationBadge t={t} onClick={() => {}} />);

      // Uses Promise constructor because apps/web compiles against the ES2022 lib (LEARNINGS.md).
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(mockFetch).not.toHaveBeenCalled();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('NotificationPanel', () => {
    it('sends Authorization bearer header when fetching notifications on mount', async () => {
      await act(async () => {
        render(
          <NotificationPanel t={t} onNavigateToComment={onNavigateToComment} onClose={onClose} />,
        );
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.getByText('Reviewer replied to your note')).toBeInTheDocument();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications?limit=20'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${TEST_SESSION_TOKEN}`,
          }),
        }),
      );
    });

    it('sends Authorization bearer header when marking a notification as read', async () => {
      const user = userEvent.setup();
      act(() => {
        render(
          <NotificationPanel t={t} onNavigateToComment={onNavigateToComment} onClose={onClose} />,
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Reviewer replied to your note')).toBeInTheDocument();
      });

      const notificationItem = screen.getByText('Reviewer replied to your note');
      await user.click(notificationItem);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/notifications/notif-1/read'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: `Bearer ${TEST_SESSION_TOKEN}`,
            }),
          }),
        );
      });
    });

    it('sends Authorization bearer header when marking all as read', async () => {
      const user = userEvent.setup();
      act(() => {
        render(
          <NotificationPanel t={t} onNavigateToComment={onNavigateToComment} onClose={onClose} />,
        );
      });

      await waitFor(() => {
        expect(screen.getByText('notifications.markAllRead')).toBeInTheDocument();
      });

      const markAllBtn = screen.getByText('notifications.markAllRead');
      await user.click(markAllBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/notifications/read-all'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: `Bearer ${TEST_SESSION_TOKEN}`,
            }),
          }),
        );
      });
    });

    it('does not send any request when unauthenticated', async () => {
      useAuthStore.setState({ sessionToken: null });

      act(() => {
        render(
          <NotificationPanel t={t} onNavigateToComment={onNavigateToComment} onClose={onClose} />,
        );
      });

      // Uses Promise constructor because apps/web compiles against the ES2022 lib (LEARNINGS.md).
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
