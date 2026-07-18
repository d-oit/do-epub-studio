import { useState, useEffect, useCallback } from 'react';
import { useReducedMotion } from '../../../../hooks/useReducedMotion';

interface Notification {
  id: string;
  bookId: string;
  commentId: string;
  parentCommentId: string | null;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationPanelProps {
  onNavigateToComment: (bookId: string, commentId: string) => void;
  t: (key: string) => string;
  onClose: () => void;
}

interface NotificationResponse {
  ok: boolean;
  data: {
    notifications: Notification[];
    total: number;
    limit: number;
    offset: number;
  };
}

export function NotificationPanel({ onNavigateToComment, t, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const prefersReduced = useReducedMotion();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=20');
      if (res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- fetch returns any
        const data: NotificationResponse = await res.json();
        setNotifications(data.data.notifications);
        setTotal(data.data.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
  }, []);

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
          <div className="p-4 text-center text-foreground/60 text-sm">
            {t('common.loading')}
          </div>
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
                    {new Date(n.createdAt).toLocaleDateString()}
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
