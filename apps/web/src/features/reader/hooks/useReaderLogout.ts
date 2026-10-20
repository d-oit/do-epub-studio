import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { apiRequest } from '../../../lib/api';
import { logClientEvent } from '../../../lib/client-logger';
import { cancelPendingRetry } from '../../../lib/offline/sync';
import { clearAllEncryptedData } from '../../../lib/offline/db';
import { useAuthStore } from '../../../stores/auth';

/**
 * Clear device-local reader data before leaving an authenticated session
 * (S1/GOAP-1002): encrypted IndexedDB rows, the Workbox `book-content` cache,
 * and — in the PWA lane — any service-worker copy of it. A purge failure is
 * reported, never swallowed into a false "signed out cleanly".
 */
async function teardownDeviceData(): Promise<boolean> {
  try {
    await clearAllEncryptedData();
    if (typeof window !== 'undefined' && 'caches' in window) {
      await window.caches.delete('book-content');
    }
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_CACHE',
        cacheName: 'book-content',
      });
    }
    return true;
  } catch (purgeErr) {
    const error = purgeErr instanceof Error ? purgeErr : new Error(String(purgeErr));
    logClientEvent({
      level: 'error',
      event: 'reader.logout_cleanup_failed',
      traceId: createTraceId(),
      spanId: createSpanId(),
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    return false;
  }
}

/**
 * Sign-out handler for the reader shell: best-effort server logout, then cancel
 * scheduled retries, clear the auth session and reader state, purge device data,
 * and redirect to `/login`.
 */
export function useReaderLogout(): () => Promise<void> {
  const navigate = useNavigate();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const logout = useAuthStore((state) => state.logout);

  return useCallback(async () => {
    try {
      await apiRequest('/api/access/logout', {
        method: 'POST',
        token: sessionToken ?? undefined,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logClientEvent({
        level: 'error',
        event: 'reader.logout_failed',
        traceId: createTraceId(),
        spanId: createSpanId(),
        error: { name: error.name, message: error.message, stack: error.stack },
      });
    } finally {
      cancelPendingRetry();
      logout();
      const cleaned = await teardownDeviceData();
      void navigate(cleaned ? '/login' : '/login?cleanup=failed');
    }
  }, [logout, navigate, sessionToken]);
}
