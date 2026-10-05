import { useState, useEffect } from 'react';
import { apiRequest } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { logThrottled } from '../../../../lib/client-logger';
import { createTraceId, createSpanId } from '@do-epub-studio/shared';

interface NotificationBadgeProps {
  t: (key: string) => string;
  onClick: () => void;
  token?: string | null;
}

export function NotificationBadge({ t, onClick, token: propToken }: NotificationBadgeProps) {
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const storeToken = useAuthStore((state) => state.sessionToken);
  const sessionToken = propToken !== undefined ? propToken : storeToken;
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!sessionToken) return;
      try {
        const data = await apiRequest<{ count: number }>('/api/notifications/unread-count', {
          token: sessionToken,
        });
        if (mounted && typeof data.count === 'number') {
          setCount(data.count);
        }
      } catch (err) {
        logThrottled('notifications.poll_failed', {
          level: 'warn',
          traceId: createTraceId(),
          spanId: createSpanId(),
          event: 'notifications.poll_failed',
          error: {
            name: 'PollError',
            message: err instanceof Error ? err.message : String(err),
          },
        });
      } finally {
        if (mounted) {
          setLoaded(true);
        }
      }
    };

    void load();
    if (!sessionToken) {
      return () => {
        mounted = false;
      };
    }
    const handleNotificationChange = () => {
      void load();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('do-epub-notification-change', handleNotificationChange);
    }

    const interval = setInterval(() => {
      void load();
    }, 30_000);

    return () => {
      mounted = false;
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('do-epub-notification-change', handleNotificationChange);
      }
    };
  }, [sessionToken]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative touch-target"
      aria-label={t('notifications.title')}
      data-loaded={loaded ? 'true' : 'false'}
    >
      {/* Bell icon */}
      <svg
        className="w-5 h-5 text-foreground/70"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
      {count > 0 && (
        <span
          className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-primary-foreground bg-primary rounded-full"
          role="status"
          aria-label={`${count} ${t('notifications.unread')}`}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
