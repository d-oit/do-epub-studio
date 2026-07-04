import { useCallback, useEffect, useRef, useState } from 'react';
import { createTraceId } from '@do-epub-studio/shared';
import { useAuthStore } from '../stores/auth';
import { apiRequest } from '../lib/api';
import { logClientEvent } from '../lib/client-logger';

const EXPIRING_WINDOW_MS = 5 * 60 * 1000;
const REFRESH_RETRY_MS = 60 * 1000;

export type SessionState = 'idle' | 'active' | 'expiring' | 'expired' | 'refreshing' | 'error';

interface UseSessionExpiryReturn {
  state: SessionState;
  expiresAt: number | null;
  msUntilExpiry: number | null;
  refresh: () => Promise<void>;
}

function computeState(
  now: number,
  expiresAt: number | null,
  inFlight: boolean,
  hasError: boolean,
): SessionState {
  if (inFlight) return 'refreshing';
  if (hasError) return 'error';
  if (expiresAt == null) return 'idle';
  const ms = expiresAt - now;
  if (ms <= 0) return 'expired';
  if (ms <= EXPIRING_WINDOW_MS) return 'expiring';
  return 'active';
}

export function useSessionExpiry(): UseSessionExpiryReturn {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const expiresAt = useAuthStore((s) => s.sessionExpiresAt);
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const logout = useAuthStore((s) => s.logout);

  const [now, setNow] = useState<number>(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const warnFiredRef = useRef(false);
  const refreshTriedRef = useRef(false);
  const lastExpiresAtRef = useRef<number | null>(expiresAt);

  // Tick once per minute; cheap.
  useEffect(() => {
    const id = setInterval(() => { setNow(Date.now()); }, 30_000);
    return () => { clearInterval(id); };
  }, []);

  // Reset transient flags when expiry moves (i.e. after a successful refresh).
  useEffect(() => {
    if (expiresAt !== lastExpiresAtRef.current) {
      lastExpiresAtRef.current = expiresAt;
      warnFiredRef.current = false;
      refreshTriedRef.current = false;
      setError(false);
    }
  }, [expiresAt]);

  const state = computeState(now, expiresAt, refreshing, error);

  // Emit a telemetry event when the session enters the expiring window.
  useEffect(() => {
    if (state === 'expiring' && !warnFiredRef.current && expiresAt != null) {
      warnFiredRef.current = true;
      logClientEvent({
        level: 'info',
        event: 'session-expiring',
        traceId: createTraceId(),
        metadata: { expiresAt, msUntilExpiry: expiresAt - now },
      });
    }
  }, [state, expiresAt, now]);

  // Auto-refresh when the session is about to expire (one attempt per cycle).
  useEffect(() => {
    if (state !== 'expiring' || refreshTriedRef.current) return;
    if (!sessionToken) return;
    refreshTriedRef.current = true;
    void doRefresh();
    async function doRefresh(): Promise<void> {
      setRefreshing(true);
      setError(false);
      try {
        const res = await apiRequest<{ sessionToken: string; expiresAt?: string }>(
          '/api/access/refresh',
          { method: 'POST', token: sessionToken ?? undefined },
        );
        if (res.sessionToken) {
          const newExpires = res.expiresAt ? new Date(res.expiresAt).getTime() : null;
          refreshSession({
            sessionToken: res.sessionToken,
            sessionExpiresAt: newExpires,
          });
          logClientEvent({
            level: 'info',
            event: 'session-refreshed',
            traceId: createTraceId(),
            metadata: { expiresAt: newExpires ?? undefined },
          });
        }
      } catch (err) {
        setError(true);
        logClientEvent({
          level: 'warn',
          event: 'session-refresh-failed',
          traceId: createTraceId(),
          error: { name: (err as Error).name, message: (err as Error).message },
        });
        // Allow a retry after REFRESH_RETRY_MS.
        setTimeout(() => {
          refreshTriedRef.current = false;
          setNow(Date.now());
        }, REFRESH_RETRY_MS);
      } finally {
        setRefreshing(false);
      }
    }
  }, [state, sessionToken, refreshSession]);

  // Forced logout on actual expiry.
  useEffect(() => {
    if (state === 'expired') {
      logClientEvent({ level: 'info', event: 'session-expired', traceId: createTraceId() });
      logout();
    }
  }, [state, logout]);

  const refresh = useCallback(async () => {
    if (!sessionToken) return;
    refreshTriedRef.current = true;
    setRefreshing(true);
    setError(false);
    try {
      const res = await apiRequest<{ sessionToken: string; expiresAt?: string }>(
        '/api/access/refresh',
        { method: 'POST', token: sessionToken },
      );
      if (res.sessionToken) {
        refreshSession({
          sessionToken: res.sessionToken,
          sessionExpiresAt: res.expiresAt ? new Date(res.expiresAt).getTime() : null,
        });
      }
    } catch (err) {
      setError(true);
      logClientEvent({
        level: 'warn',
        event: 'session-refresh-failed-manual',
        traceId: createTraceId(),
        error: { name: (err as Error).name, message: (err as Error).message },
      });
    } finally {
      setRefreshing(false);
    }
  }, [sessionToken, refreshSession]);

  return {
    state,
    expiresAt,
    msUntilExpiry: expiresAt == null ? null : Math.max(0, expiresAt - now),
    refresh,
  };
}
