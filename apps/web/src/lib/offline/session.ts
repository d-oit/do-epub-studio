import { useAuthStore } from '@/stores/auth';

/**
 * Session token for an authenticated API write issued by the offline replay
 * engine.
 *
 * The worker protects every reader route with `readerAuth`, which rejects a
 * request without a bearer token. A replay that omits the token therefore
 * fails with 401 — and, for the raw `api.*` helpers, resolves as a "success"
 * because they do not throw on a non-2xx status, so the queued item would be
 * dropped instead of retried.
 */
export function requireSessionToken(): string {
  const token = useAuthStore.getState().sessionToken;
  if (!token) {
    const error = new Error('Session expired');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
  return token;
}
