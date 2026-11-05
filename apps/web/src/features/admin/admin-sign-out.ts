import { createTraceId } from '@do-epub-studio/shared';
import { apiRequest } from '../../lib/api';
import { logClientEvent } from '../../lib/client-logger';
import { useAuthStore } from '../../stores/auth';

/**
 * Ends the current administrator session: revokes the bearer token on the
 * server and always clears the client session, even when revocation fails
 * (a network error must not leave a stale token in place).
 */
export async function signOutAdmin(): Promise<void> {
  const token = useAuthStore.getState().sessionToken;
  try {
    if (token) {
      await apiRequest('/api/admin/logout', { method: 'POST', token });
    }
  } catch (error) {
    logClientEvent({
      level: 'warn',
      traceId: createTraceId(),
      event: 'admin.logout_failed',
      error: {
        name: (error as Error).name,
        message: (error as Error).message,
      },
    });
  } finally {
    useAuthStore.getState().logout('manual');
  }
}
