import { useState, useEffect, useCallback } from 'react';
import { useReducedMotion } from '../../../../hooks/useReducedMotion';
import { formatDate } from '../../../../lib/i18n-format';
import { apiRequest } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface NotificationRecord {
  id: string;
  bookId: string;
  commentId: string;
  parentCommentId: string | null;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

function isNotificationRecord(value: unknown): value is NotificationRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.bookId === 'string' &&
    typeof v.commentId === 'string' &&
    typeof v.type === 'string' &&
    typeof v.message === 'string' &&
    typeof v.createdAt === 'string' &&
    (v.readAt === null || typeof v.readAt === 'string') &&
    (v.parentCommentId === null || typeof v.parentCommentId === 'string')
  );
}

/**
 * Boundary guard for `GET /api/notifications`. Kept handler-local and
 * dependency-free: this module is part of the reader route chunk, whose total
 * budget does not fit the ~12 KB `zod` runtime (ADR-107 §3).
 */
function parseNotificationList(
  value: unknown,
): { notifications: NotificationRecord[]; total: number } | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.notifications) || typeof v.total !== 'number') return null;
  if (!v.notifications.every(isNotificationRecord)) return null;
  return { notifications: v.notifications, total: v.total };
}

interface NotificationPanelProps {
  onNavigateToComment: (bookId: string, commentId: string) => void;
  t: (key: string) => string;
  onClose: () => void;
  token?: string | null;
}

export function NotificationPanel({
  onNavigateToComment,
  t,
  onClose,
  token: propToken,
}: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const prefersReduced = useReducedMotion();
  const storeToken = useAuthStore((state) => state.sessionToken);
  const sessionToken = propToken !== undefined ? propToken : storeToken;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!sessionToken) {
        if (mounted) setLoading(false);
        return;
      }
      try {
        const data = await apiRequest<unknown>('/api/notifications?limit=20', {
          token: sessionToken,
        });
        const parsed = parseNotificationList(data);
        if (!parsed) throw new Error('Unexpected notifications payload');
        if (mounted) {
          setNotifications(parsed.notifications);
          setTotal(parsed.total);
        }
      } catch (err) {
        console.error('Failed to load notifications', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [sessionToken]);

  const handleMarkAsRead = useCallback(
    async (id: string) => {
      if (!sessionToken) return;
      try {
        await apiRequest(`/api/notifications/${id}/read`, {
          method: 'POST',
          token: sessionToken,
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('do-epub-notification-change'));
        }
      } catch (err) {
        console.error('Failed to mark notification as read', err);
      }
    },
    [sessionToken],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    if (!sessionToken) return;
    try {
      await apiRequest('/api/notifications/read-all', {
        method: 'POST',
        token: sessionToken,
      });
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('do-epub-notification-change'));
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
    }
  }, [sessionToken]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div
      className="notification-panel bg-background border border-foreground/10 rounded-lg shadow-lg max-w-sm w-full"
      role="dialog"
      aria-label={t('notifications.title')}
    >
      <div className="flex items-center justify-between p-3 border-b border-foreground/10">
        <h2 className="text-sm font-semibold text-foreground">
          {t('notifications.title')} ({total})
        </h2>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void handleMarkAllAsRead()}
              className="text-xs text-foreground/60 hover:text-foreground touch-target"
            >
              {t('notifications.markAllRead')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-foreground/60 hover:text-foreground touch-target"
            aria-label={t('common.close')}
          >
            {t('common.close')}
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-foreground/60 text-sm">{t('common.loading')}</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-foreground/60 text-sm">
            {t('notifications.empty')}
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`w-full text-left p-3 border-b border-foreground/5 hover:bg-foreground/5 transition-colors ${
                !n.readAt ? 'bg-foreground/[0.03]' : ''
              } ${prefersReduced ? '' : 'transition-all duration-150'}`}
              onClick={() => {
                void handleMarkAsRead(n.id);
                onNavigateToComment(n.bookId, n.commentId);
              }}
            >
              <div className="flex items-start gap-2">
                {!n.readAt && (
                  <span
                    className="inline-block w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0"
                    role="status"
                    aria-label={t('notifications.unread')}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground line-clamp-2">{n.message}</p>
                  <time className="text-xs text-foreground/50 mt-1">
                    {formatDate(new Date(n.createdAt))}
                  </time>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
